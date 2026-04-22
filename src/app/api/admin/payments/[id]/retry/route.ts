import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { retryChargePayment } from '@/lib/payments/retry-charge'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Phase 7-D-2-a: 관리자 결제 재시도 (단건).
 *
 * POST /api/admin/payments/[id]/retry
 *
 * 상세 흐름과 에러 분기는 lib/payments/retry-charge.ts 참조.
 * Toss 비즈니스 실패(카드 한도 등)는 200 + success:false로 정상 응답.
 * 인프라 실패(키 없음, 네트워크)만 5xx.
 */
export async function POST(_req: Request, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: paymentId } = await params

  const supabase = createSupabaseAdminClient()
  const result = await retryChargePayment({
    supabase,
    orgId: guard.ctx.tenant.id,
    paymentId,
  })

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      INVALID_STATUS: 400,
      BILLING_KEY_MISSING: 400,
      RATE_LIMITED: 429,
      TOSS_UNAVAILABLE: 503,
    }
    const status = statusMap[result.error] ?? 500
    const body: Record<string, unknown> = { error: result.error }
    if (result.retryAfterMs != null) body.retryAfterMs = result.retryAfterMs
    return NextResponse.json(body, { status })
  }

  // 감사 로그 — 성공/실패 모두 기록
  logAudit({
    orgId: guard.ctx.tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'payment.retry_cms',
    resourceType: 'payment',
    resourceId: paymentId,
    summary: result.success ? '재청구 성공' : `재청구 실패: ${result.message}`,
    metadata: {
      success: result.success,
      message: result.message,
      toss_payment_key: result.tossPaymentKey ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    success: result.success,
    message: result.message,
    tossPaymentKey: result.tossPaymentKey ?? null,
  })
}
