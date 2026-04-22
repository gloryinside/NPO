import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createManualPayment,
  type ManualPayMethod,
} from '@/lib/payments/manual-create'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Phase 7-D-2-a: 관리자 수기 납부 기록.
 *
 * POST /api/admin/members/[id]/manual-payment
 * Body: { amount, payDate, payMethod, campaignId?, note? }
 *
 * auto-promise 정책 — 약정 행을 자동 생성한 뒤 payment를 얹는다.
 * 상세는 lib/payments/manual-create.ts 주석 참조.
 */

const ALLOWED_METHODS: readonly ManualPayMethod[] = [
  'cash',
  'transfer',
  'manual',
]

export async function POST(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: memberId } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const amount = Number(body.amount)
  const payDate =
    typeof body.payDate === 'string' ? body.payDate.slice(0, 10) : ''
  const payMethodRaw = body.payMethod
  const campaignIdRaw = body.campaignId
  const noteRaw = body.note

  if (
    typeof payMethodRaw !== 'string' ||
    !ALLOWED_METHODS.includes(payMethodRaw as ManualPayMethod)
  ) {
    return NextResponse.json({ error: 'INVALID_METHOD' }, { status: 400 })
  }

  const campaignId =
    typeof campaignIdRaw === 'string' && campaignIdRaw.trim().length > 0
      ? campaignIdRaw.trim()
      : null

  const note =
    typeof noteRaw === 'string' && noteRaw.trim().length > 0
      ? noteRaw.trim().slice(0, 500)
      : null

  const supabase = createSupabaseAdminClient()

  // member 소속 검증
  const { data: memberRow } = await supabase
    .from('members')
    .select('id, name')
    .eq('id', memberId)
    .eq('org_id', guard.ctx.tenant.id)
    .maybeSingle()

  if (!memberRow) {
    return NextResponse.json({ error: 'MEMBER_NOT_FOUND' }, { status: 404 })
  }

  const result = await createManualPayment({
    supabase,
    orgId: guard.ctx.tenant.id,
    memberId,
    amount,
    payDate,
    payMethod: payMethodRaw as ManualPayMethod,
    campaignId,
    note,
  })

  if (!result.ok) {
    const status = result.error === 'INSERT_FAILED' ? 500 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  // 감사 로그 — fire-and-forget
  logAudit({
    orgId: guard.ctx.tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'payment.mark_paid',
    resourceType: 'payment',
    resourceId: result.paymentId,
    summary: `${(memberRow as { name: string }).name} 수기 납부 기록 (${payMethodRaw})`,
    metadata: {
      manual: true,
      pay_method: payMethodRaw,
      amount,
      pay_date: payDate,
      note,
      promise_id: result.promiseId,
    },
  }).catch(() => {})

  return NextResponse.json({
    ok: true,
    paymentId: result.paymentId,
    promiseId: result.promiseId,
    paymentCode: result.paymentCode,
  })
}
