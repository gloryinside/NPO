import { NextRequest, NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { getTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import {
  createCheerMessage,
  listPublicCheerMessages,
  CHEER_MAX_LENGTH,
} from '@/lib/cheer/messages'
import { analyzeProfanity } from '@/lib/cheer/profanity'
import { rateLimit, getClientIp, normalizeIpForKey } from '@/lib/rate-limit'
import { revalidateCheerCampaignPath } from '@/lib/cheer/revalidate'

/**
 * Phase 5-D: 캠페인 응원 메시지 — 공개 조회 + 후원자 등록.
 *
 * GET  /api/cheer?campaignId=<uuid>&limit=50
 *   - 공개. tenant(도메인) 기준으로 응원 목록 반환. 익명이면 이름 마스킹.
 *   - campaignId 생략 시 "일반 응원"(캠페인 없음) 벽.
 *
 * POST /api/cheer
 *   - donor 세션 필수. body: { campaignId?: string|null, body: string, anonymous?: boolean }
 *   - rate limit: member 기준 분당 3건 (lib 내 1시간 3건 위에 추가 방어)
 */

export async function GET(req: NextRequest) {
  const tenant = await getTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_resolved' }, { status: 400 })
  }

  // G-108: 공개 GET IP 기반 rate limit — 크롤러/봇 보호
  // 분당 60회는 사람이 페이지를 자주 새로고침해도 여유 있는 한도.
  // G-113: IPv6는 /64 prefix로 마스킹해 같은 대역 우회 차단.
  const ipKey = normalizeIpForKey(getClientIp(req.headers))
  const rl = rateLimit(`cheer:get:${ipKey}`, 60, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'rate_limited' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.retryAfterMs / 1000)) },
      }
    )
  }

  const campaignIdRaw = req.nextUrl.searchParams.get('campaignId')
  const limitRaw = req.nextUrl.searchParams.get('limit')
  const limit = limitRaw ? Number(limitRaw) : 50
  if (!Number.isFinite(limit) || limit < 1) {
    return NextResponse.json({ error: 'invalid_limit' }, { status: 400 })
  }

  // G-110: 커서 기반 페이지네이션 — `before`는 이전 페이지 마지막 행의 createdAt
  const beforeRaw = req.nextUrl.searchParams.get('before')
  const before =
    beforeRaw && !Number.isNaN(Date.parse(beforeRaw)) ? beforeRaw : null

  const supabase = createSupabaseAdminClient()
  const messages = await listPublicCheerMessages(supabase, {
    orgId: tenant.id,
    campaignId: campaignIdRaw && campaignIdRaw.trim() ? campaignIdRaw : null,
    limit,
    before,
  })

  // 반환 건수가 limit과 같으면 다음 페이지가 있을 "가능성"이 있다 — 마지막 행
  // createdAt을 nextCursor로 내려준다. 정확히 한 페이지 남았을 때 한 번 더
  // fetch가 발생할 수 있지만 lib에서 빈 배열을 반환하므로 UX에 무해.
  const nextCursor =
    messages.length === limit ? messages[messages.length - 1]!.createdAt : null

  return NextResponse.json({ messages, nextCursor })
}

export async function POST(req: NextRequest) {
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`cheer:post:${session.member.id}`, 3, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const rawBody = body.body
  if (typeof rawBody !== 'string' || rawBody.trim().length === 0) {
    return NextResponse.json({ error: 'empty_body' }, { status: 400 })
  }
  if (rawBody.length > CHEER_MAX_LENGTH + 100) {
    // 본문이 아주 비정상적으로 길면 lib 전에 차단
    return NextResponse.json({ error: 'too_long' }, { status: 400 })
  }

  const campaignIdRaw = body.campaignId
  const campaignId =
    typeof campaignIdRaw === 'string' && campaignIdRaw.trim().length > 0
      ? campaignIdRaw.trim()
      : null

  const anonymous =
    typeof body.anonymous === 'boolean' ? body.anonymous : true

  // G-109: 비속어/스팸 간이 필터
  //   - block: 저장 거부
  //   - suspicious: published=false로 저장 → admin 승인 대기
  //   - clean: 즉시 공개
  const profanity = analyzeProfanity(rawBody)
  if (profanity.verdict === 'block') {
    return NextResponse.json(
      { error: 'profanity_blocked' },
      { status: 400 }
    )
  }
  const published = profanity.verdict !== 'suspicious'

  const supabase = createSupabaseAdminClient()

  // 캠페인 id가 주어졌으면 같은 org 소속인지 확인 (cross-tenant 차단)
  if (campaignId) {
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, org_id')
      .eq('id', campaignId)
      .eq('org_id', session.member.org_id)
      .maybeSingle()
    if (!campaign) {
      return NextResponse.json(
        { error: 'campaign_not_found' },
        { status: 404 }
      )
    }
  }

  const result = await createCheerMessage({
    supabase,
    orgId: session.member.org_id,
    campaignId,
    memberId: session.member.id,
    body: rawBody,
    anonymous,
    published,
  })

  if (!result.ok) {
    const status =
      result.error === 'rate_limited'
        ? 429
        : result.error === 'insert_failed'
          ? 500
          : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  // G-116: 공개 상태로 저장된 경우 ISR 즉시 무효화
  if (published && campaignId) {
    await revalidateCheerCampaignPath(supabase, result.id)
  }

  return NextResponse.json({
    ok: true,
    id: result.id,
    published,
    pendingReview: !published,
  })
}
