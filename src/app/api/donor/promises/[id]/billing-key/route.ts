import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { deleteBillingKey, issueBillingKey } from '@/lib/billing/toss-billing'
import { openBillingKey, sealBillingKey } from '@/lib/billing/billing-key-store'
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
    .select('id, org_id, member_id, type, status, toss_billing_key, suspended_until')
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

  // 끝난 약정에는 새 카드를 묶지 않는다
  if (promise.status === 'cancelled' || promise.status === 'completed') {
    return NextResponse.json({ error: '종료된 약정은 결제수단을 변경할 수 없습니다.' }, { status: 409 })
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

  // 결제 실패로 정지된 약정(후원자가 직접 멈춘 suspended_until 없음)은 새 카드 등록 시 재개
  const reactivate =
    promise.status === 'pending_billing' || (promise.status === 'suspended' && !promise.suspended_until)
  const { error: updateError } = await supabase
    .from('promises')
    .update({
      toss_billing_key: await sealBillingKey(result.billingKey),
      customer_key: customerKey,
      status: reactivate ? 'active' : promise.status,
      // G-D50: 카드 만료일 저장 (사전 알림용)
      card_expiry_year: normalizeExpiryYear(cardExpirationYear),
      card_expiry_month: Number(cardExpirationMonth),
    })
    .eq('id', promiseId)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)

  if (updateError) {
    // 저장 실패 — 방금 발급한 새 키를 토스에서 지워 고아 키를 남기지 않는다
    await deleteBillingKey(keys.tossSecretKey, result.billingKey)
    return NextResponse.json(
      { error: 'DB 업데이트 실패. 관리자에게 문의해주세요.' },
      { status: 500 },
    )
  }

  // 예전 키 폐기 — 토스 규격: 쓰지 않는 빌링키는 삭제. 실패해도 새 카드는 이미 적용됨(로그만)
  const oldKey = await openBillingKey(promise.toss_billing_key)
  if (oldKey && oldKey !== result.billingKey) {
    const del = await deleteBillingKey(keys.tossSecretKey, oldKey)
    if (!del.ok) console.error(`[billing-key] promise ${promiseId}: 이전 빌링키 삭제 실패`, del.error)
  }

  return NextResponse.json({ ok: true })
}

/**
 * G-D50: Toss가 "25" 형태(2자리)로 넘길 수 있어 4자리 연도로 정규화.
 */
function normalizeExpiryYear(yearRaw: string | undefined): number | null {
  if (!yearRaw) return null
  const n = Number(yearRaw)
  if (!Number.isFinite(n)) return null
  if (n >= 2000 && n <= 2100) return n
  if (n >= 0 && n <= 99) return 2000 + n
  return null
}
