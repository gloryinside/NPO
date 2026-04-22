import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 7-D-1: 회원/비회원 계정 상태 계산.
 *
 * 기준:
 *   - members.supabase_uid IS NOT NULL → linked (로그인 가능 회원)
 *   - 비회원 + 최근 N일 내 member_invite 메일 발송 이력 → invited
 *   - 비회원 + 이력은 있으나 N일 경과 → invite_expired
 *   - 비회원 + 이력 없음 → unlinked
 *
 * 스키마 변경 없음 — email_notifications_log(kind='member_invite')를 단일 진실로 사용.
 */

export type AccountState =
  | 'linked'
  | 'invited'
  | 'invite_expired'
  | 'unlinked'

export const DEFAULT_INVITE_WINDOW_DAYS = 30

export interface AccountStateOptions {
  supabaseUid: string | null
  inviteWindowDays?: number
}

/**
 * 단일 회원 상태 조회. invite 이력이 필요한 경우에만 DB 쿼리 1회.
 */
export async function resolveAccountState(
  supabase: SupabaseClient,
  memberId: string,
  opts: AccountStateOptions
): Promise<AccountState> {
  if (opts.supabaseUid) return 'linked'

  const windowDays = opts.inviteWindowDays ?? DEFAULT_INVITE_WINDOW_DAYS
  const { data } = await supabase
    .from('email_notifications_log')
    .select('sent_at')
    .eq('ref_id', memberId)
    .eq('kind', 'member_invite')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const sentAt = (data as { sent_at: string | null } | null)?.sent_at ?? null
  if (!sentAt) return 'unlinked'

  const age = Date.now() - Date.parse(sentAt)
  const windowMs = windowDays * 86_400_000
  return Number.isFinite(age) && age <= windowMs ? 'invited' : 'invite_expired'
}

export interface BatchMemberInput {
  id: string
  supabase_uid: string | null
}

export interface BatchResult {
  state: AccountState
  lastInviteSentAt: string | null
}

/**
 * 목록 페이지용 배치 조회. ref_id IN (...) 한 번에 긁어 memberId → 최신 sent_at 맵 생성.
 */
export async function resolveAccountStatesBatch(
  supabase: SupabaseClient,
  members: BatchMemberInput[],
  opts?: { inviteWindowDays?: number }
): Promise<Map<string, BatchResult>> {
  const result = new Map<string, BatchResult>()
  if (members.length === 0) return result

  const unlinkedIds: string[] = []
  for (const m of members) {
    if (m.supabase_uid) {
      result.set(m.id, { state: 'linked', lastInviteSentAt: null })
    } else {
      unlinkedIds.push(m.id)
    }
  }

  if (unlinkedIds.length === 0) return result

  const { data } = await supabase
    .from('email_notifications_log')
    .select('ref_id, sent_at')
    .in('ref_id', unlinkedIds)
    .eq('kind', 'member_invite')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })

  // 최신 sent_at per ref_id (ordered desc → 첫 등장이 최신)
  const latest = new Map<string, string>()
  for (const row of (data as Array<{ ref_id: string; sent_at: string }>) ?? []) {
    if (!latest.has(row.ref_id)) latest.set(row.ref_id, row.sent_at)
  }

  const windowDays = opts?.inviteWindowDays ?? DEFAULT_INVITE_WINDOW_DAYS
  const windowMs = windowDays * 86_400_000
  const now = Date.now()

  for (const id of unlinkedIds) {
    const sentAt = latest.get(id) ?? null
    if (!sentAt) {
      result.set(id, { state: 'unlinked', lastInviteSentAt: null })
      continue
    }
    const age = now - Date.parse(sentAt)
    const state: AccountState =
      Number.isFinite(age) && age <= windowMs ? 'invited' : 'invite_expired'
    result.set(id, { state, lastInviteSentAt: sentAt })
  }

  return result
}

export const ACCOUNT_STATE_LABEL: Record<AccountState, string> = {
  linked: '회원',
  invited: '초대됨',
  invite_expired: '초대 만료',
  unlinked: '비회원',
}
