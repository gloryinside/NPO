import { describe, it, expect, vi } from 'vitest'
import {
  ensureReferralCode,
  findReferrerByCode,
  getReferralStats,
  getMemberReferralCode,
} from '@/lib/donor/referral'
import type { SupabaseClient } from '@supabase/supabase-js'

/** from/select/eq/insert 체인을 시퀀스로 스텁 */
function stub(sequence: Array<{ data?: unknown; error?: { code?: string; message?: string } }>) {
  let idx = 0
  function makeChain() {
    const result = () => sequence[idx++] ?? { data: null }
    const chain: Record<string, unknown> = {}
    const returnChain = () => chain
    chain.select = returnChain
    chain.eq = returnChain
    chain.in = returnChain
    chain.insert = returnChain
    chain.order = () => Promise.resolve(result())
    chain.maybeSingle = () => Promise.resolve(result())
    chain.then = (onFulfilled: (v: unknown) => unknown) =>
      Promise.resolve(result()).then(onFulfilled)
    return chain
  }
  return { from: vi.fn().mockImplementation(() => makeChain()) } as unknown as SupabaseClient
}

describe('ensureReferralCode', () => {
  it('기존 코드 있으면 그대로 반환', async () => {
    const existing = {
      id: 'r1',
      org_id: 'o1',
      member_id: 'm1',
      code: 'abcd1234',
      created_at: '2024-01-01',
    }
    const s = stub([{ data: existing }])
    const r = await ensureReferralCode(s, 'o1', 'm1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.code.code).toBe('abcd1234')
  })

  it('없으면 새 코드 생성', async () => {
    const s = stub([
      { data: null }, // getMemberReferralCode
      {
        data: {
          id: 'r2',
          org_id: 'o1',
          member_id: 'm1',
          code: 'xyzabc12',
          created_at: '2024-02-01',
        },
      }, // insert
    ])
    const r = await ensureReferralCode(s, 'o1', 'm1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.code.code).toMatch(/^[a-z0-9]{8}$/)
  })

  it('충돌 3회 연속 시 실패', async () => {
    const s = stub([
      { data: null },
      { error: { code: '23505', message: 'dup' } },
      { error: { code: '23505', message: 'dup' } },
      { error: { code: '23505', message: 'dup' } },
    ])
    const r = await ensureReferralCode(s, 'o1', 'm1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('code_collision_exceeded')
  })
})

describe('findReferrerByCode', () => {
  it('코드로 member/org 조회', async () => {
    const s = stub([{ data: { member_id: 'm1', org_id: 'o1' } }])
    const r = await findReferrerByCode(s, 'ABCD1234')
    expect(r).toEqual({ memberId: 'm1', orgId: 'o1' })
  })

  it('빈 코드는 null', async () => {
    const s = stub([])
    const r = await findReferrerByCode(s, '  ')
    expect(r).toBeNull()
  })

  it('없는 코드는 null', async () => {
    const s = stub([{ data: null }])
    const r = await findReferrerByCode(s, 'nonexist')
    expect(r).toBeNull()
  })
})

describe('getReferralStats', () => {
  it('초대 0건이면 빈 결과', async () => {
    const s = stub([{ data: [] }])
    const r = await getReferralStats(s, 'm-ref')
    expect(r).toEqual({ invitedCount: 0, totalRaisedByInvitees: 0, invitees: [] })
  })

  it('초대한 회원의 결제 합계 집계', async () => {
    const members = [
      { id: 'i1', name: '김○○', created_at: '2024-03-01' },
      { id: 'i2', name: '이○○', created_at: '2024-05-01' },
    ]
    const payments = [
      { member_id: 'i1', amount: 10_000 },
      { member_id: 'i1', amount: 20_000 },
      { member_id: 'i2', amount: 50_000 },
    ]
    const s = stub([{ data: members }, { data: payments }])
    const r = await getReferralStats(s, 'm-ref')
    expect(r.invitedCount).toBe(2)
    expect(r.totalRaisedByInvitees).toBe(80_000)
    expect(r.invitees).toEqual([
      { memberId: 'i1', name: '김○○', joinedAt: '2024-03-01', totalAmount: 30_000 },
      { memberId: 'i2', name: '이○○', joinedAt: '2024-05-01', totalAmount: 50_000 },
    ])
  })
})

describe('getMemberReferralCode', () => {
  it('없으면 null', async () => {
    const s = stub([{ data: null }])
    const r = await getMemberReferralCode(s, 'm1')
    expect(r).toBeNull()
  })

  it('있으면 정규화된 객체', async () => {
    const s = stub([
      {
        data: {
          id: 'r1',
          org_id: 'o1',
          member_id: 'm1',
          code: 'abcd1234',
          created_at: '2024-01-01',
        },
      },
    ])
    const r = await getMemberReferralCode(s, 'm1')
    expect(r).toEqual({
      id: 'r1',
      orgId: 'o1',
      memberId: 'm1',
      code: 'abcd1234',
      createdAt: '2024-01-01',
    })
  })
})
