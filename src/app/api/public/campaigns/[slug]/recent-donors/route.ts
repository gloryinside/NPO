import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { getClientIp, rateLimit } from '@/lib/rate-limit'

export const revalidate = 30

/**
 * Tier S #5: 최근 후원자 피드.
 *
 * GET /api/public/campaigns/[slug]/recent-donors?limit=10
 *
 * Privacy: 이름은 첫 글자만 노출 ("홍○○"), 금액은 정확히 표시, 시간은 상대 시간.
 * 후원자 익명 옵션이 있으면 "익명" 처리.
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const ip = getClientIp(req.headers)
  const limit = rateLimit(`public:recent-donors:${ip}`, 60, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const tenant = await getTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'tenant not resolved' }, { status: 400 })
  }

  const { slug } = await ctx.params
  const urlObj = new URL(req.url)
  const reqLimit = Math.min(Number(urlObj.searchParams.get('limit') ?? 10), 30)

  const supabase = createSupabaseAdminClient()

  // 캠페인 조회
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('org_id', tenant.id)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  if (!campaign) {
    return NextResponse.json({ donors: [] })
  }

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, approved_at, pay_date, members(name)')
    .eq('org_id', tenant.id)
    .eq('campaign_id', campaign.id)
    .eq('pay_status', 'paid')
    .order('approved_at', { ascending: false, nullsFirst: false })
    .order('pay_date', { ascending: false, nullsFirst: false })
    .range(0, reqLimit - 1)

  const donors = (payments ?? []).map((p) => {
    const member = (p as unknown as { members?: { name?: string } | null }).members
    const name = member?.name ?? ''
    // 마스킹: 첫 글자만, 나머지는 ○
    const masked = name
      ? name.charAt(0) + '○'.repeat(Math.max(name.length - 1, 1))
      : '익명'
    return {
      masked_name: masked,
      amount: Number(p.amount ?? 0),
      at: p.approved_at ?? p.pay_date,
    }
  })

  return NextResponse.json(
    { donors },
    { headers: { 'Cache-Tag': `campaign:${slug}:recent-donors` } },
  )
}
