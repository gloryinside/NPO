import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 5-D: 응원 메시지 lib.
 *
 * 공개 조회는 서버 컴포넌트/공개 API에서, 등록은 donor 세션 API에서 호출한다.
 * 이름 마스킹은 서버에서 처리해 원본을 클라이언트로 보내지 않는다.
 */

export const CHEER_MIN_LENGTH = 1
export const CHEER_MAX_LENGTH = 500

export interface CheerMessage {
  id: string
  campaignId: string | null
  displayName: string // 마스킹된 노출용 이름
  body: string
  createdAt: string
}

export interface CreateCheerParams {
  supabase: SupabaseClient
  orgId: string
  campaignId: string | null
  memberId: string
  body: string
  anonymous: boolean
  /** 비속어 의심 시 false로 넘겨 관리자 승인 대기 상태로 저장 */
  published?: boolean
}

export type CreateCheerResult =
  | { ok: true; id: string }
  | {
      ok: false
      error:
        | 'empty_body'
        | 'too_long'
        | 'rate_limited'
        | 'insert_failed'
    }

/**
 * 이름 마스킹: "홍길동" → "홍○○", "A" → "A○".
 * 이모지/서러게이트 페어 안전하도록 Array.from 사용.
 */
export function maskName(raw: string | null | undefined): string {
  const chars = Array.from((raw ?? '').trim())
  if (chars.length === 0) return '후원자'
  const head = chars[0]
  const tailLen = Math.max(1, Math.min(3, chars.length - 1))
  return head + '○'.repeat(tailLen)
}

/**
 * 최근 60분 내 같은 member가 같은 캠페인에 남긴 응원 개수.
 * 단순 throttle: 1시간 3건 초과면 rate_limited.
 */
async function countRecentByMember(
  supabase: SupabaseClient,
  memberId: string,
  campaignId: string | null
): Promise<number> {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  let query = supabase
    .from('cheer_messages')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .gte('created_at', since)

  if (campaignId === null) {
    query = query.is('campaign_id', null)
  } else {
    query = query.eq('campaign_id', campaignId)
  }

  const { count } = await query
  return count ?? 0
}

export async function createCheerMessage(
  params: CreateCheerParams
): Promise<CreateCheerResult> {
  const {
    supabase,
    orgId,
    campaignId,
    memberId,
    body,
    anonymous,
    published,
  } = params

  const trimmed = (body ?? '').trim()
  if (trimmed.length < CHEER_MIN_LENGTH) {
    return { ok: false, error: 'empty_body' }
  }
  if (trimmed.length > CHEER_MAX_LENGTH) {
    return { ok: false, error: 'too_long' }
  }

  const recent = await countRecentByMember(supabase, memberId, campaignId)
  if (recent >= 3) {
    return { ok: false, error: 'rate_limited' }
  }

  const { data, error } = await supabase
    .from('cheer_messages')
    .insert({
      org_id: orgId,
      campaign_id: campaignId,
      member_id: memberId,
      body: trimmed,
      anonymous,
      published: published ?? true,
    })
    .select('id')
    .maybeSingle()

  if (error || !data?.id) {
    return { ok: false, error: 'insert_failed' }
  }
  return { ok: true, id: data.id as string }
}

/**
 * 공개 응원 메시지 조회 (캠페인별 또는 일반).
 *   - 기본 50건, 최대 200건
 *   - 최신순
 *   - hidden=false AND published=true 만
 *   - anonymous=true면 displayName 마스킹
 */
export async function listPublicCheerMessages(
  supabase: SupabaseClient,
  params: {
    orgId: string
    campaignId: string | null
    limit?: number
  }
): Promise<CheerMessage[]> {
  const limit = Math.min(Math.max(1, params.limit ?? 50), 200)

  let query = supabase
    .from('cheer_messages')
    .select(
      'id, campaign_id, body, anonymous, created_at, member:members(id, name)'
    )
    .eq('org_id', params.orgId)
    .eq('published', true)
    .eq('hidden', false)

  if (params.campaignId === null) {
    query = query.is('campaign_id', null)
  } else {
    query = query.eq('campaign_id', params.campaignId)
  }

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(limit)
  const rows = (data ?? []) as unknown as Array<{
    id: string
    campaign_id: string | null
    body: string
    anonymous: boolean
    created_at: string
    member: { id: string; name: string | null } | null
  }>

  return rows.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    displayName: r.anonymous
      ? maskName(r.member?.name ?? '')
      : (r.member?.name ?? '후원자'),
    body: r.body,
    createdAt: r.created_at,
  }))
}

/**
 * 관리자용: 숨김 토글. 본 lib는 tenant isolation 전제라 호출부에서 org_id 검증 필요.
 */
export async function setCheerHidden(
  supabase: SupabaseClient,
  id: string,
  hidden: boolean,
  reason: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from('cheer_messages')
    .update({ hidden, hidden_reason: hidden ? reason : null })
    .eq('id', id)
  return !error
}

/**
 * Phase 6-B / G-112: 관리자 승인 토글.
 * profanity.suspicious로 published=false 상태로 대기된 글을 공개로 전환.
 * 숨김과는 독립적 — hidden은 별도 필드.
 */
export async function setCheerPublished(
  supabase: SupabaseClient,
  id: string,
  published: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('cheer_messages')
    .update({ published })
    .eq('id', id)
  return !error
}

export interface OwnCheerMessage {
  id: string
  campaignId: string | null
  campaignTitle: string | null
  body: string
  anonymous: boolean
  published: boolean
  hidden: boolean
  hiddenReason: string | null
  createdAt: string
}

/**
 * Phase 6-B / G-111: donor 본인이 쓴 응원 전체 (공개 여부/숨김 상태 무관).
 */
export async function listOwnCheerMessages(
  supabase: SupabaseClient,
  memberId: string
): Promise<OwnCheerMessage[]> {
  const { data } = await supabase
    .from('cheer_messages')
    .select(
      'id, campaign_id, body, anonymous, published, hidden, hidden_reason, created_at, campaigns(title)'
    )
    .eq('member_id', memberId)
    .order('created_at', { ascending: false })
    .limit(200)

  const rows = (data ?? []) as unknown as Array<{
    id: string
    campaign_id: string | null
    body: string
    anonymous: boolean
    published: boolean
    hidden: boolean
    hidden_reason: string | null
    created_at: string
    campaigns: { title: string | null } | null
  }>

  return rows.map((r) => ({
    id: r.id,
    campaignId: r.campaign_id,
    campaignTitle: r.campaigns?.title ?? null,
    body: r.body,
    anonymous: r.anonymous,
    published: r.published,
    hidden: r.hidden,
    hiddenReason: r.hidden_reason,
    createdAt: r.created_at,
  }))
}

/**
 * Phase 6-B / G-111: 본인 soft-delete.
 *   - hidden=true + hidden_reason='self_deleted' 마커
 *   - member_id = session member 일치 검증
 *   - 이미 admin이 다른 사유로 hidden 처리한 건은 건드리지 않음(idempotent)
 *
 * 반환: 업데이트된 행 수 (0이면 권한 없음/미존재)
 */
export async function softDeleteOwnCheer(
  supabase: SupabaseClient,
  id: string,
  memberId: string
): Promise<{ ok: boolean; notFound?: boolean }> {
  // 소유자 검증 + admin hidden 덮어쓰기 방지를 위해 .eq hidden=false 조건
  const { data, error } = await supabase
    .from('cheer_messages')
    .update({ hidden: true, hidden_reason: 'self_deleted' })
    .eq('id', id)
    .eq('member_id', memberId)
    .eq('hidden', false)
    .select('id')

  if (error) return { ok: false }
  if (!data || data.length === 0) return { ok: false, notFound: true }
  return { ok: true }
}
