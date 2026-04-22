import { describe, it, expect, vi } from 'vitest'
import {
  maskName,
  createCheerMessage,
  listPublicCheerMessages,
  listOwnCheerMessages,
  softDeleteOwnCheer,
  CHEER_MAX_LENGTH,
} from '@/lib/cheer/messages'
import type { SupabaseClient as _SC } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * cheer lib는 테이블 하나에 대한 count/insert/select 체인을 모두 사용한다.
 * 각 체인의 종료 메서드(then/limit/maybeSingle)를 thenable로 돌려주는 stub을 쓴다.
 */
function buildSupabase(opts: {
  recentCount?: number
  insertResult?: { data?: { id: string } | null; error?: unknown }
  listRows?: Array<Record<string, unknown>>
}) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = (_col: string, options?: { head?: boolean; count?: string }) => {
    if (options?.head && options?.count === 'exact') {
      // countRecentByMember 경로: select('id',{count,head}) → eq/gte/is → then
      const countChain: Record<string, unknown> = {}
      const rc = () => countChain
      countChain.eq = rc
      countChain.gte = rc
      countChain.is = rc
      countChain.then = (onFulfilled: (v: unknown) => unknown) =>
        Promise.resolve({ count: opts.recentCount ?? 0 }).then(onFulfilled)
      return countChain
    }
    return chain
  }
  chain.eq = ret
  chain.gte = ret
  chain.is = ret
  chain.order = ret
  chain.limit = () =>
    Promise.resolve({ data: opts.listRows ?? [], error: null })
  chain.maybeSingle = () =>
    Promise.resolve({
      data: opts.insertResult?.data ?? null,
      error: opts.insertResult?.error ?? null,
    })
  chain.insert = () => chain
  chain.update = () => ({
    eq: () => Promise.resolve({ error: null }),
  })
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: opts.listRows ?? [], error: null }).then(
      onFulfilled
    )

  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

describe('maskName', () => {
  it('빈 문자열은 "후원자"', () => {
    expect(maskName('')).toBe('후원자')
    expect(maskName(null)).toBe('후원자')
  })
  it('한 글자는 첫 글자 + ○', () => {
    expect(maskName('A')).toBe('A○')
  })
  it('여러 글자는 첫 글자 + ○ 반복 (최대 3)', () => {
    expect(maskName('홍길동')).toBe('홍○○')
    expect(maskName('Alice Liddell')).toBe('A○○○')
  })
})

describe('createCheerMessage', () => {
  it('빈 body는 empty_body', async () => {
    const s = buildSupabase({})
    const r = await createCheerMessage({
      supabase: s,
      orgId: 'o1',
      campaignId: null,
      memberId: 'm1',
      body: '   ',
      anonymous: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('empty_body')
  })

  it('과도한 길이는 too_long', async () => {
    const s = buildSupabase({})
    const r = await createCheerMessage({
      supabase: s,
      orgId: 'o1',
      campaignId: null,
      memberId: 'm1',
      body: 'x'.repeat(CHEER_MAX_LENGTH + 1),
      anonymous: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('too_long')
  })

  it('최근 1시간 3건 이상이면 rate_limited', async () => {
    const s = buildSupabase({ recentCount: 3 })
    const r = await createCheerMessage({
      supabase: s,
      orgId: 'o1',
      campaignId: 'c1',
      memberId: 'm1',
      body: '응원합니다',
      anonymous: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('rate_limited')
  })

  it('정상 등록 시 id 반환', async () => {
    const s = buildSupabase({
      recentCount: 0,
      insertResult: { data: { id: 'cheer-1' } },
    })
    const r = await createCheerMessage({
      supabase: s,
      orgId: 'o1',
      campaignId: 'c1',
      memberId: 'm1',
      body: '화이팅',
      anonymous: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.id).toBe('cheer-1')
  })

  it('insert 실패 시 insert_failed', async () => {
    const s = buildSupabase({
      recentCount: 0,
      insertResult: { data: null, error: { message: 'db' } },
    })
    const r = await createCheerMessage({
      supabase: s,
      orgId: 'o1',
      campaignId: null,
      memberId: 'm1',
      body: '화이팅',
      anonymous: true,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('insert_failed')
  })
})

describe('listOwnCheerMessages', () => {
  it('본인 응원 + 캠페인 타이틀 정규화', async () => {
    // limit()가 종결이 아니라 .order()가 Promise로 끝나는 기존 stub 구조를 활용.
    // 단 실 lib은 .limit(200)을 호출하므로 limit 체인이 필요 → buildSupabase 확장 대신 간단 직렬화
    const rows = [
      {
        id: 'c1',
        campaign_id: 'camp1',
        body: '응원',
        anonymous: true,
        published: true,
        hidden: false,
        hidden_reason: null,
        created_at: '2026-04-22T00:00:00Z',
        campaigns: { title: '아동교육' },
      },
    ]
    const chain: Record<string, unknown> = {}
    const ret = () => chain
    chain.select = ret
    chain.eq = ret
    chain.order = ret
    chain.limit = () => Promise.resolve({ data: rows, error: null })
    const s = {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as _SC
    const r = await listOwnCheerMessages(s, 'm1')
    expect(r).toEqual([
      {
        id: 'c1',
        campaignId: 'camp1',
        campaignTitle: '아동교육',
        body: '응원',
        anonymous: true,
        published: true,
        hidden: false,
        hiddenReason: null,
        createdAt: '2026-04-22T00:00:00Z',
      },
    ])
  })
})

describe('softDeleteOwnCheer', () => {
  function updateStub(rowsAfter: Array<{ id: string }> | null) {
    const updChain: Record<string, unknown> = {}
    const ret = () => updChain
    updChain.eq = ret
    updChain.select = () =>
      Promise.resolve({
        data: rowsAfter,
        error: null,
      })
    const chain: Record<string, unknown> = {
      update: () => updChain,
    }
    return {
      from: vi.fn().mockReturnValue(chain),
    } as unknown as _SC
  }

  it('본인 소유 응원이면 ok=true', async () => {
    const s = updateStub([{ id: 'c1' }])
    const r = await softDeleteOwnCheer(s, 'c1', 'm1')
    expect(r).toEqual({ ok: true })
  })

  it('업데이트된 행이 없으면 notFound', async () => {
    const s = updateStub([])
    const r = await softDeleteOwnCheer(s, 'c1', 'm1')
    expect(r.ok).toBe(false)
    expect(r.notFound).toBe(true)
  })
})

describe('listPublicCheerMessages', () => {
  it('anonymous면 마스킹된 displayName', async () => {
    const s = buildSupabase({
      listRows: [
        {
          id: 'c1',
          campaign_id: null,
          body: '응원합니다',
          anonymous: true,
          created_at: '2026-04-22T00:00:00Z',
          member: { id: 'm1', name: '홍길동' },
        },
        {
          id: 'c2',
          campaign_id: null,
          body: '함께해요',
          anonymous: false,
          created_at: '2026-04-21T00:00:00Z',
          member: { id: 'm2', name: '김철수' },
        },
      ],
    })
    const r = await listPublicCheerMessages(s, {
      orgId: 'o1',
      campaignId: null,
    })
    expect(r).toHaveLength(2)
    expect(r[0].displayName).toBe('홍○○')
    expect(r[1].displayName).toBe('김철수')
  })

  it('member null이면 "후원자"로 fallback', async () => {
    const s = buildSupabase({
      listRows: [
        {
          id: 'c1',
          campaign_id: 'camp-1',
          body: '응원',
          anonymous: true,
          created_at: '2026-04-22T00:00:00Z',
          member: null,
        },
      ],
    })
    const r = await listPublicCheerMessages(s, {
      orgId: 'o1',
      campaignId: 'camp-1',
    })
    expect(r[0].displayName).toBe('후원자')
  })
})
