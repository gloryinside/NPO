import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { issueBillingKey } from '@/lib/billing/toss-billing'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { checkCsrf } from '@/lib/security/csrf'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Tier A #10: 후원자 결제수단(빌링키) 변경.
 *
 * POST /api/donor/promises/[id]/billing-key
 * body: { cardNumber, cardExpirationYear, cardExpirationMonth, cardPassword, customerIdentityNumber }
 *
 * - 본인 약정만 (member_id 확인)
 * - regular 타입만
 * - rate limit: 5회 / 1시간
 * - 발급 성공 시 toss_billing_key + customer_key 교체, status → active (pending_billing이었다면)
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const ip = getClientIp(req.headers)
  const limit = rateLimit(`donor:billing-key:${session.member.id}:${ip}`, 5, 3_600_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const { id: promiseId } = await params

  let body: {
    cardNumber?: string
    cardExpirationYear?: string
    cardExpirationMonth?: string
    cardPassword?: string
    customerIdentityNumber?: string
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    cardNumber,
    cardExpirationYear,
    cardExpirationMonth,
    cardPassword,
    customerIdentityNumber,
  } = body

  if (
    !cardNumber ||
    !cardExpirationYear ||
    !cardExpirationMonth ||
    !cardPassword ||
    !customerIdentityNumber
  ) {
    return NextResponse.json({ error: '카드 정보가 부족합니다.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  const { data: promise } = await supabase
    .from('promises')
    .select('id, org_id, member_id, type, status')
    .eq('id', promiseId)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle()

  if (!promise) {
    return NextResponse.json({ error: '약정을 찾을 수 없습니다.' }, { status: 404 })
  }

  if (promise.type !== 'regular') {
    return NextResponse.json(
      { error: '정기후원 약정에서만 결제수단을 변경할 수 있습니다.' },
      { status: 400 },
    )
  }

  const keys = await getOrgTossKeys(promise.org_id)
  if (!keys.tossSecretKey) {
    return NextResponse.json(
      { error: '결제 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.' },
      { status: 503 },
    )
  }

  const customerKey = randomUUID()
  const result = await issueBillingKey(keys.tossSecretKey, customerKey, {
    cardNumber,
    cardExpirationYear,
    cardExpirationMonth,
    cardPassword,
    customerIdentityNumber,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? '카드 등록 실패. 정보를 확인해주세요.' },
      { status: 400 },
    )
  }

  const { error: updateError } = await supabase
    .from('promises')
    .update({
      toss_billing_key: result.billingKey,
      customer_key: customerKey,
      // pending_billing 상태였다면 active로 복원
      status: promise.status === 'pending_billing' ? 'active' : promise.status,
    })
    .eq('id', promiseId)
    .eq('member_id', session.member.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'DB 업데이트 실패. 관리자에게 문의해주세요.' },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true })
}
