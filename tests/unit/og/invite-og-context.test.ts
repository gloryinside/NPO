import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  loadInviteOgContext,
  FALLBACK_ORG,
  isValidRefShape,
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

  it('G-121: 너무 짧은 ref는 DB 조회 없이 fallback', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, 'abc')
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('G-121: 너무 긴 ref는 DB 조회 없이 fallback', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, 'a'.repeat(17))
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('G-121: 공격성 수천자 ref도 즉시 fallback', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, 'x'.repeat(5000))
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('G-121: 공백/제어문자 섞이면 fallback', async () => {
    const supabase = stub([])
    const ctx = await loadInviteOgContext(supabase, 'code 123')
    expect(ctx).toEqual({ orgName: FALLBACK_ORG, inviterName: null })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('isValidRefShape', () => {
  it.each([
    ['abcdef', true],
    ['ABCDEF', true],
    ['code1234', true],
    ['a1b2c3d4e5f6g7', true],
    ['a'.repeat(16), true],
    ['a'.repeat(17), false],
    ['abc', false],
    ['', false],
    ['코드1234', false], // non-ASCII
    ['abc def', false], // whitespace
    ['abc\t123', false], // control char
  ])('shape(%j) === %s', (input, expected) => {
    expect(isValidRefShape(input)).toBe(expected)
  })
})
