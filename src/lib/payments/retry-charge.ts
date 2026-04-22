import type { SupabaseClient } from '@supabase/supabase-js'
import { chargeBillingKey } from '@/lib/billing/toss-billing'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { rateLimit } from '@/lib/rate-limit'

/**
 * Phase 7-D-2-a: 관리자 수동 "결제 재시도".
 *
 * 배치 processRetries는 cron이 주기적으로 실행하지만, 관리자가 상담 중 즉시
 * 한 건을 재청구해야 할 때를 위한 개별 경로. 다음이 모두 충족되면 호출:
 *   - pay_status ∈ ('failed','unpaid')
 *   - promise.toss_billing_key != null
 *   - rate limit 미초과 (member 1h/3회 + payment 1d/5회)
 *
 * Toss 호출 결과는 성공/실패 모두 "정상 응답"으로 취급 — HTTP 200 + success:bool 반환.
 * 인프라 실패(네트워크/키 없음)만 5xx.
 */

const MEMBER_RATE_LIMIT = 3
const MEMBER_WINDOW_MS = 60 * 60 * 1000 // 1시간
const PAYMENT_RATE_LIMIT = 5
const PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000 // 1일

export interface RetryChargeInput {
  supabase: SupabaseClient
  orgId: string
  paymentId: string
}

export type RetryChargeResult =
  | {
      ok: true
      success: boolean
      message: string
      tossPaymentKey?: string | null
    }
  | {
      ok: false
      error:
        | 'NOT_FOUND'
        | 'INVALID_STATUS'
        | 'BILLING_KEY_MISSING'
        | 'RATE_LIMITED'
        | 'TOSS_UNAVAILABLE'
      retryAfterMs?: number
    }

type PaymentRow = {
  id: string
  member_id: string | null
  pay_status: string
  payment_code: string
  amount: number
  org_id: string
  promises: {
    toss_billing_key: string | null
    customer_key: string | null
  } | null
}

export async function retryChargePayment(
  input: RetryChargeInput
): Promise<RetryChargeResult> {
  const { supabase, orgId, paymentId } = input

  // 1. payment + promise 조인 조회
  const { data } = await supabase
    .from('payments')
    .select(
      'id, member_id, pay_status, payment_code, amount, org_id, promises(toss_billing_key, customer_key)'
    )
    .eq('id', paymentId)
    .eq('org_id', orgId)
    .maybeSingle()

  const row = data as unknown as PaymentRow | null
  if (!row) return { ok: false, error: 'NOT_FOUND' }

  // 2. 상태 검증
  if (row.pay_status !== 'failed' && row.pay_status !== 'unpaid') {
    return { ok: false, error: 'INVALID_STATUS' }
  }

  // 3. billingKey 검증
  const billingKey = row.promises?.toss_billing_key ?? null
  const customerKey = row.promises?.customer_key ?? null
  if (!billingKey || !customerKey) {
    return { ok: false, error: 'BILLING_KEY_MISSING' }
  }

  // 4. rate limit — member + payment 이중 쿼터
  if (row.member_id) {
    const memberRl = rateLimit(
      `retry:member:${row.member_id}`,
      MEMBER_RATE_LIMIT,
      MEMBER_WINDOW_MS
    )
    if (!memberRl.allowed) {
      return {
        ok: false,
        error: 'RATE_LIMITED',
        retryAfterMs: memberRl.retryAfterMs,
      }
    }
  }
  const paymentRl = rateLimit(
    `retry:payment:${paymentId}`,
    PAYMENT_RATE_LIMIT,
    PAYMENT_WINDOW_MS
  )
  if (!paymentRl.allowed) {
    return {
      ok: false,
      error: 'RATE_LIMITED',
      retryAfterMs: paymentRl.retryAfterMs,
    }
  }

  // 5. Toss 키 조회
  const keys = await getOrgTossKeys(orgId)
  if (!keys.tossSecretKey) {
    return { ok: false, error: 'TOSS_UNAVAILABLE' }
  }

  // 6. 재청구
  const result = await chargeBillingKey(keys.tossSecretKey, billingKey, {
    customerKey,
    amount: row.amount,
    orderId: row.payment_code,
    orderName: '정기후원 재시도',
  })

  // 7. 결과 반영
  const nowIso = new Date().toISOString()
  if (result.success) {
    await supabase
      .from('payments')
      .update({
        pay_status: 'paid',
        toss_payment_key: result.paymentKey,
        approved_at: nowIso,
        deposit_date: nowIso.slice(0, 10),
        fail_reason: null,
        updated_at: nowIso,
      })
      .eq('id', paymentId)

    return {
      ok: true,
      success: true,
      message: '재청구 성공',
      tossPaymentKey: result.paymentKey,
    }
  }

  // 실패: 기록만 업데이트, 상태는 failed로 고정
  await supabase
    .from('payments')
    .update({
      pay_status: 'failed',
      fail_reason: result.failureMessage,
      updated_at: nowIso,
    })
    .eq('id', paymentId)

  return {
    ok: true,
    success: false,
    message: result.failureMessage,
  }
}
