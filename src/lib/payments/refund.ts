import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgTossKeys } from '@/lib/toss/keys'

/**
 * Phase 7-D-2-b: 관리자 환불 핵심 로직.
 *
 * Toss 결제 취소(전액/부분) → DB 상태 반영(pay_status=refunded).
 * Toss API 실패 시 DB 변경 없이 조기 반환 — atomicity 보장.
 *
 * reasonCode: 내부 분류 (donor_request | duplicate | error | other)
 * reasonNote: 자유 텍스트 (부가 설명)
 *
 * Toss에는 사람이 읽을 수 있는 한글 사유를 보내고, DB cancel_reason에는
 * 분석/통계용으로 `code:note` 형식으로 저장한다.
 */

export type ReasonCode = 'donor_request' | 'duplicate' | 'error' | 'other'

const REASON_LABELS: Record<ReasonCode, string> = {
  donor_request: '후원자 요청',
  duplicate: '중복 결제',
  error: '오류',
  other: '기타',
}

export interface RefundParams {
  supabase: SupabaseClient
  orgId: string
  paymentId: string
  reasonCode: ReasonCode
  reasonNote?: string
  /** 부분 환불 금액. 생략 시 전액 환불. */
  refundAmount?: number
}

export type RefundResult =
  | { ok: true; refundAmount: number | null }
  | {
      ok: false
      error:
        | 'NOT_FOUND'
        | 'INVALID_STATUS'
        | 'OFFLINE_PAYMENT'
        | 'INVALID_AMOUNT'
        | 'TOSS_FAILED'
        | 'DB_FAILED'
      message?: string
    }

export async function refundPayment(params: RefundParams): Promise<RefundResult> {
  const { supabase, orgId, paymentId, reasonCode, reasonNote, refundAmount } = params

  // 1. payment 조회 + tenant 격리
  const { data: payment } = await supabase
    .from('payments')
    .select('id, org_id, amount, pay_status, toss_payment_key')
    .eq('id', paymentId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!payment) return { ok: false, error: 'NOT_FOUND' }

  // 2. 상태 검증 — paid 만 환불 가능
  if (payment.pay_status !== 'paid') {
    return { ok: false, error: 'INVALID_STATUS' }
  }

  // 3. 오프라인 결제 배제 — Toss API 호출 불가
  if (!payment.toss_payment_key) {
    return { ok: false, error: 'OFFLINE_PAYMENT' }
  }

  // 4. 금액 검증 — 부분 환불일 때만
  if (refundAmount !== undefined) {
    if (refundAmount <= 0 || refundAmount > payment.amount) {
      return { ok: false, error: 'INVALID_AMOUNT' }
    }
  }

  // 5. Toss 키 조회
  const { tossSecretKey } = await getOrgTossKeys(orgId)

  // 6. Toss 취소 API 호출
  const tossCancelReason = reasonNote
    ? `${REASON_LABELS[reasonCode]} - ${reasonNote}`
    : REASON_LABELS[reasonCode]

  const body: Record<string, unknown> = { cancelReason: tossCancelReason }
  if (refundAmount !== undefined) body.cancelAmount = refundAmount

  const tossRes = await fetch(
    `https://api.tosspayments.com/v1/payments/${payment.toss_payment_key}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${tossSecretKey}:`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!tossRes.ok) {
    const err = (await tossRes.json().catch(() => ({}))) as Record<string, unknown>
    return {
      ok: false,
      error: 'TOSS_FAILED',
      message: typeof err.message === 'string' ? err.message : undefined,
    }
  }

  // 7. DB 업데이트 — cancel_reason에는 code:note 형식으로 저장
  const dbCancelReason = reasonNote ? `${reasonCode}:${reasonNote}` : reasonCode
  const nowIso = new Date().toISOString()

  const { error: dbErr } = await supabase
    .from('payments')
    .update({
      pay_status: 'refunded',
      refund_amount: refundAmount ?? null,
      cancelled_at: nowIso,
      cancel_reason: dbCancelReason,
      updated_at: nowIso,
    })
    .eq('id', paymentId)
    .eq('org_id', orgId)
    .select()

  if (dbErr) {
    return {
      ok: false,
      error: 'DB_FAILED',
      message: (dbErr as { message?: string }).message,
    }
  }

  return { ok: true, refundAmount: refundAmount ?? null }
}
