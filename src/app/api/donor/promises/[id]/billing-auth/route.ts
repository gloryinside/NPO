import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/donor/promises/[id]/billing-auth — 결제수단 변경(표준: 토스 결제창).
 * 결제창을 열 수 있게 { customerKey, clientKey }를 돌려준다. 카드 정보는 받지 않는다.
 * 완료는 /donor/promises/billing/success 에서 authKey로 빌링키를 발급·교체한다.
 *
 * customerKey는 약정에 저장된 값을 재사용(토스: 구매자 ID — 카드가 바뀌어도 구매자는 같다).
 * 없으면 무작위 UUID를 만들어 먼저 저장한다(유추 불가 값이어야 함).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ip = getClientIp(req.headers)
  const limit = rateLimit(`donor:billing-auth:${session.member.id}:${ip}`, 5, 3_600_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: '너무 많은 시도입니다. 잠시 후 다시 시도해주세요.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const { id: promiseId } = await params
  const supabase = createSupabaseAdminClient()
  const { data: promise } = await supabase
    .from('promises')
    .select('id, type, status, customer_key')
    .eq('id', promiseId)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle()

  if (!promise) return NextResponse.json({ error: '약정을 찾을 수 없습니다.' }, { status: 404 })
  if (promise.type !== 'regular') {
    return NextResponse.json({ error: '정기후원 약정에서만 결제수단을 변경할 수 있습니다.' }, { status: 400 })
  }
  if (promise.status === 'cancelled' || promise.status === 'completed') {
    return NextResponse.json({ error: '종료된 약정은 결제수단을 변경할 수 없습니다.' }, { status: 409 })
  }

  const keys = await getOrgTossKeys(session.member.org_id)
  if (!keys.tossClientKey) {
    return NextResponse.json({ error: '결제 서비스가 설정되지 않았습니다. 관리자에게 문의해주세요.' }, { status: 503 })
  }

  let customerKey = promise.customer_key as string | null
  if (!customerKey) {
    customerKey = randomUUID()
    const { error } = await supabase
      .from('promises')
      .update({ customer_key: customerKey })
      .eq('id', promiseId)
      .eq('org_id', session.member.org_id)
      .is('customer_key', null)
    if (error) return NextResponse.json({ error: '결제수단 변경을 시작하지 못했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ customerKey, clientKey: keys.tossClientKey })
}
