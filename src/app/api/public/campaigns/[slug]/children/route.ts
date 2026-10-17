import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { getClientIp, rateLimit } from '@/lib/rate-limit'
import { toPublicChild } from '@/lib/sponsorship/pick'

/**
 * GET /api/public/campaigns/[slug]/children
 *
 * 결연 아동 선택 신청 화면에 보일 아이 목록. 캠페인 신청서 설정에서 '결연 아동 선택'을 켠 경우만.
 * 공개로 설정된 아이 중 지금 결연할 수 있는 아이만, 이름은 성만 보인다(lib/sponsorship/pick).
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const ip = getClientIp(req.headers)
  const limit = rateLimit(`public:children:${ip}`, 30, 60_000)
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(limit.retryAfterMs / 1000)) } },
    )
  }

  const tenant = await getTenant()
  if (!tenant) return NextResponse.json({ error: 'tenant not resolved' }, { status: 400 })

  const { slug } = await ctx.params
  const supabase = createSupabaseAdminClient()
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, form_settings')
    .eq('org_id', tenant.id)
    .eq('slug', slug)
    .eq('status', 'active')
    .maybeSingle()

  const fs = (campaign?.form_settings ?? {}) as { sponsorshipPick?: boolean; sponsorshipProgramId?: string | null }
  if (!campaign || !fs.sponsorshipPick) return NextResponse.json({ children: [] })

  let q = supabase
    .from('beneficiaries')
    .select('id, code, name, birth_year, gender, region, bio, photo_url')
    .eq('org_id', tenant.id)
    .eq('status', 'available')
    .eq('public_listing', true)
    .or(`reserved_until.is.null,reserved_until.lt.${new Date().toISOString()}`)
    .order('enrolled_at', { ascending: true, nullsFirst: false })
    .limit(24)
  if (fs.sponsorshipProgramId) q = q.eq('program_id', fs.sponsorshipProgramId)

  const { data, error } = await q
  if (error) {
    console.error('[public/children] list failed:', error.message)
    return NextResponse.json({ error: '목록을 불러오지 못했습니다.' }, { status: 500 })
  }
  const thisYear = Number(new Intl.DateTimeFormat('en', { timeZone: 'Asia/Seoul', year: 'numeric' }).format(new Date()))
  return NextResponse.json(
    { children: (data ?? []).map((r) => toPublicChild(r, thisYear)) },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
