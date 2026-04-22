import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadInviteOgContext,
  FALLBACK_ORG,
} from '@/app/api/public/invite-og/route'

/**
 * referral_codes/orgs/members 세 테이블 조회 결과를 시퀀스로 주입.
 * 순서: referral_codes → orgs → members.
 */
function stub(sequence: Array<{ data?: unknown; error?: unknown }>) {
  let idx = 0
  const makeChain = () => {
    const result = () => sequence[idx++] ?? { data: null }
    const chain: Record<string, unknown> = {}
    const ret = () => chain
    chain.select = ret
    chain.eq = ret
    chain.maybeSingle = () => Promise.resolve(result())
    return chain
  }
  return { from: vi.fn().mockImplementation(makeChain) } as unknown as SupabaseClient
}

describe('loadInviteOgContext', () => {
  it('ref 없으면 fallback 기관명 + inviterName null', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, null)
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
  })

  it('빈 문자열 ref도 fallback 처리', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, '')
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
  })

  it('존재하지 않는 ref면 fallback', async () => {
    const supabase = stub([
      { data: null }, // findReferrerByCode: not found
    ])
    const ctx = await loadInviteOgContext(supabase, 'unknowncode')
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
  })

  it('유효한 ref면 기관명과 초대자 이름 반환', async () => {
    const supabase = stub([
      { data: { member_id: 'mid-1', org_id: 'oid-1' } }, // referral_codes
      { data: { name: '희망나눔재단' } }, // orgs
      { data: { name: '홍길동' } }, // members
    ])
    const ctx = await loadInviteOgContext(supabase, 'code1234')
    expect(ctx.orgName).toBe('희망나눔재단')
    expect(ctx.inviterName).toBe('홍길동')
  })

  it('orgs name 누락 시 fallback 기관명 + 초대자 이름은 유지', async () => {
    const supabase = stub([
      { data: { member_id: 'mid-1', org_id: 'oid-1' } },
      { data: null }, // orgs 없음
      { data: { name: '홍길동' } },
    ])
    const ctx = await loadInviteOgContext(supabase, 'code1234')
    expect(ctx.orgName).toBe(FALLBACK_ORG)
    expect(ctx.inviterName).toBe('홍길동')
  })

  it('members name 누락 시 inviterName null', async () => {
    const supabase = stub([
      { data: { member_id: 'mid-1', org_id: 'oid-1' } },
      { data: { name: '희망나눔재단' } },
      { data: null },
    ])
    const ctx = await loadInviteOgContext(supabase, 'code1234')
    expect(ctx.orgName).toBe('희망나눔재단')
    expect(ctx.inviterName).toBeNull()
  })
})
