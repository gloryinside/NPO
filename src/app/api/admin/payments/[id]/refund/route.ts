import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { refundPayment, type ReasonCode } from '@/lib/payments/refund'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_REASON_CODES: ReasonCode[] = ['donor_request', 'duplicate', 'error', 'other']

export async function POST(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: paymentId } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reasonCode, reasonNote, refundAmount } = body as {
    reasonCode?: string
    reasonNote?: string
    refundAmount?: number
  }

  if (!reasonCode || !VALID_REASON_CODES.includes(reasonCode as ReasonCode)) {
    return NextResponse.json({ error: '유효한 환불 사유를 선택해주세요.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const result = await refundPayment({
    supabase,
    orgId: guard.ctx.tenant.id,
    paymentId,
    reasonCode: reasonCode as ReasonCode,
    reasonNote: reasonNote?.trim() || undefined,
    refundAmount: typeof refundAmount === 'number' ? refundAmount : undefined,
  })

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      INVALID_STATUS: 400,
      OFFLINE_PAYMENT: 400,
      INVALID_AMOUNT: 400,
      TOSS_FAILED: 502,
      DB_FAILED: 500,
    }
    const msgMap: Record<string, string> = {
      NOT_FOUND: '납입 정보를 찾을 수 없습니다.',
      INVALID_STATUS: '환불 가능한 상태가 아닙니다.',
      OFFLINE_PAYMENT: '온라인 결제만 환불 가능합니다.',
      INVALID_AMOUNT: '유효한 환불 금액을 입력해주세요.',
      TOSS_FAILED: `결제 취소 실패: ${result.message ?? ''}`,
      DB_FAILED: 'DB 업데이트 실패. 관리자에게 문의해주세요.',
    }
    return NextResponse.json(
      { error: msgMap[result.error] ?? result.error },
      { status: statusMap[result.error] ?? 500 }
    )
  }

  logAudit({
    orgId: guard.ctx.tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'payment.refund',
    resourceType: 'payment',
    resourceId: paymentId,
    summary: result.refundAmount
      ? `부분 환불 처리 (${result.refundAmount.toLocaleString('ko-KR')}원)`
      : '전액 환불 처리',
    metadata: {
      refund_amount: result.refundAmount,
      reason_code: reasonCode,
      reason_note: reasonNote ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
