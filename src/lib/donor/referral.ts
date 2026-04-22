import type { SupabaseClient } from '@supabase/supabase-js'
import { customAlphabet } from 'nanoid'

/**
 * Phase 5-B: 후원자 초대 코드 lib.
 *
 * 코드는 8자 소문자 + 숫자(혼동 문자 제외) — 읽기/입력 편의.
 * 전역 unique — INSERT 충돌 시 재생성 (확률 매우 낮음, 최대 3회 시도).
 */

// 0, o, 1, i, l 제거한 알파벳 (혼동 방지)
const ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
const generate = customAlphabet(ALPHABET, 8)

export interface ReferralCode {
  id: string
  orgId: string
  memberId: string
  code: string
  createdAt: string
}

/**
 * 회원의 기존 코드 조회. 없으면 null.
 */
export async function getMemberReferralCode(
  supabase: SupabaseClient,
  memberId: string,
): Promise<ReferralCode | null> {
  const { data } = await supabase
    .from('referral_codes')
    .select('id, org_id, member_id, code, created_at')
    .eq('member_id', memberId)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id as string,
    orgId: data.org_id as string,
    memberId: data.member_id as string,
    code: data.code as string,
    createdAt: data.created_at as string,
  }
}

/**
 * 회원에게 코드 부여. 이미 있으면 그대로 반환 (idempotent).
 * 8자 코드 충돌 시 최대 3회 재시도.
 */
export async function ensureReferralCode(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<{ ok: true; code: ReferralCode } | { ok: false; error: string }> {
  const existing = await getMemberReferralCode(supabase, memberId)
  if (existing) return { ok: true, code: existing }

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generate()
    const { data, error } = await supabase
      .from('referral_codes')
      .insert({ org_id: orgId, member_id: memberId, code })
      .select('id, org_id, member_id, code, created_at')
      .maybeSingle()

    if (!error && data) {
      return {
        ok: true,
        code: {
          id: data.id as string,
          orgId: data.org_id as string,
          memberId: data.member_id as string,
          code: data.code as string,
          createdAt: data.created_at as string,
        },
      }
    }
    // UNIQUE 위반(23505)만 재시도, 그 외는 에러
    if (error?.code !== '23505') {
      return { ok: false, error: error?.message ?? 'insert_failed' }
    }
  }
  return { ok: false, error: 'code_collision_exceeded' }
}

/**
 * 코드로 추천인 member 조회 (가입 플로우에서 사용).
 * 반환: { memberId, orgId } — 같은 org만 허용하려면 호출부에서 orgId 일치 체크.
 */
export async function findReferrerByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ memberId: string; orgId: string } | null> {
  const normalized = code.trim().toLowerCase()
  if (!normalized) return null

  const { data } = await supabase
    .from('referral_codes')
    .select('member_id, org_id')
    .eq('code', normalized)
    .maybeSingle()

  if (!data) return null
  return {
    memberId: data.member_id as string,
    orgId: data.org_id as string,
  }
}

/**
 * 추천인이 초대한 회원 수 + 각 회원의 누적 후원액(paid).
 */
export interface ReferralStats {
  invitedCount: number
  totalRaisedByInvitees: number
  invitees: Array<{ memberId: string; name: string; joinedAt: string; totalAmount: number }>
}

export async function getReferralStats(
  supabase: SupabaseClient,
  referrerMemberId: string,
): Promise<ReferralStats> {
  const { data: members } = await supabase
    .from('members')
    .select('id, name, created_at')
    .eq('referrer_id', referrerMemberId)
    .order('created_at', { ascending: false })

  const rows = (members ?? []) as Array<{ id: string; name: string; created_at: string }>
  if (rows.length === 0) {
    return { invitedCount: 0, totalRaisedByInvitees: 0, invitees: [] }
  }

  const memberIds = rows.map((r) => r.id)
  const { data: payments } = await supabase
    .from('payments')
    .select('member_id, amount')
    .in('member_id', memberIds)
    .eq('pay_status', 'paid')

  const byMember = new Map<string, number>()
  for (const p of payments ?? []) {
    const mid = p.member_id as string
    byMember.set(mid, (byMember.get(mid) ?? 0) + Number(p.amount ?? 0))
  }

  const invitees = rows.map((r) => ({
    memberId: r.id,
    name: r.name,
    joinedAt: r.created_at,
    totalAmount: byMember.get(r.id) ?? 0,
  }))
  const totalRaisedByInvitees = invitees.reduce((s, i) => s + i.totalAmount, 0)

  return {
    invitedCount: rows.length,
    totalRaisedByInvitees,
    invitees,
  }
}
