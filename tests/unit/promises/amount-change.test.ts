import { describe, it, expect, vi } from 'vitest'
import {
  classifyDirection,
  changePromiseAmount,
  listAmountChanges,
  MIN_PROMISE_AMOUNT,
  MAX_PROMISE_AMOUNT,
} from '@/lib/promises/amount-change'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 테이블별 응답을 시퀀스로 돌려주는 체인 stub.
 * promises/payments update는 error만, promise_amount_changes insert는 data를 기대한다.
 */
function buildSupabase(responses: {
  promisesUpdate?: { error?: { message: string } | null }
  paymentsUpdate?: { error?: { message: string } | null }
  historyInsert?: { data?: { id: string } | null; error?: { message: string } | null }
  historyList?: Array<Record<string, unknown>>
}) {
  function makeChain(kind: string) {
    const chain: Record<string, unknown> = {}
    const ret = () => chain
    chain.select = ret
    chain.eq = ret
    chain.is = ret
    chain.order = () =>
      Promise.resolve({ data: responses.historyList ?? [], error: null })
    chain.maybeSingle = () => {
      if (kind === 'history_insert') {
        return Promise.resolve({
          data: responses.historyInsert?.data ?? null,
          error: responses.historyInsert?.error ?? null,
        })
      }
      return Promise.resolve({ data: null, error: null })
    }
    chain.update = () => {
      // update는 eq/is 체인 뒤에 await된다. then 구현으로 처리.
      const updChain = { ...chain } as Record<string, unknown>
      updChain.then = (onFulfilled: (v: unknown) => unknown) => {
        const res =
          kind === 'promises'
            ? { error: responses.promisesUpdate?.error ?? null }
            : { error: responses.paymentsUpdate?.error ?? null }
        return Promise.resolve(res).then(onFulfilled)
      }
      updChain.eq = () => updChain
      updChain.is = () => updChain
      return updChain
    }
    chain.insert = () => chain
    return chain
  }

  return {
    from: vi.fn().mockImplementation((name: string) => {
      if (name === 'promises') return makeChain('promises')
      if (name === 'payments') return makeChain('payments')
      if (name === 'promise_amount_changes') return makeChain('history_insert')
      return makeChain(name)
    }),
  } as unknown as SupabaseClient
}

describe('classifyDirection', () => {
  it('증액은 up', () => expect(classifyDirection(10_000, 20_000)).toBe('up'))
  it('감액은 down', () => expect(classifyDirection(20_000, 10_000)).toBe('down'))
  it('동일은 same', () => expect(classifyDirection(10_000, 10_000)).toBe('same'))
})

describe('changePromiseAmount', () => {
  it('유효 범위 외 금액은 거부', async () => {
    const s = buildSupabase({})
    const r1 = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 10_000,
      newAmount: 0,
      actor: 'member',
    })
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.error).toBe('invalid_amount')

    const r2 = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 10_000,
      newAmount: MIN_PROMISE_AMOUNT - 1,
      actor: 'member',
    })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error).toBe('below_minimum')

    const r3 = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 10_000,
      newAmount: MAX_PROMISE_AMOUNT + 1,
      actor: 'member',
    })
    expect(r3.ok).toBe(false)
    if (!r3.ok) expect(r3.error).toBe('above_maximum')
  })

  it('업그레이드는 direction=up + 이력 id 반환', async () => {
    const s = buildSupabase({
      historyInsert: { data: { id: 'hist-1' } },
    })
    const r = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 30_000,
      newAmount: 50_000,
      actor: 'member',
      reason: '더 많이 돕고 싶어요',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.direction).toBe('up')
      expect(r.previousAmount).toBe(30_000)
      expect(r.newAmount).toBe(50_000)
      expect(r.historyId).toBe('hist-1')
    }
  })

  it('다운그레이드는 direction=down', async () => {
    const s = buildSupabase({ historyInsert: { data: { id: 'h2' } } })
    const r = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 50_000,
      newAmount: 30_000,
      actor: 'member',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.direction).toBe('down')
  })

  it('promises update 실패 시 update_failed', async () => {
    const s = buildSupabase({
      promisesUpdate: { error: { message: 'db down' } },
    })
    const r = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 10_000,
      newAmount: 20_000,
      actor: 'member',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('update_failed')
  })

  it('이력 INSERT 실패해도 주 변경은 성공, historyId는 null', async () => {
    const s = buildSupabase({
      historyInsert: { data: null, error: { message: 'history fail' } },
    })
    const r = await changePromiseAmount({
      supabase: s,
      promiseId: 'p1',
      orgId: 'o1',
      memberId: 'm1',
      currentAmount: 10_000,
      newAmount: 20_000,
      actor: 'member',
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.historyId).toBeNull()
  })
})

describe('listAmountChanges', () => {
  it('없으면 빈 배열', async () => {
    const s = buildSupabase({ historyList: [] })
    const r = await listAmountChanges(s, 'p1')
    expect(r).toEqual([])
  })

  it('필드 정규화', async () => {
    const s = buildSupabase({
      historyList: [
        {
          id: 'h1',
          previous_amount: 30000,
          new_amount: 50000,
          direction: 'up',
          actor: 'member',
          reason: null,
          created_at: '2026-04-22T00:00:00Z',
        },
      ],
    })
    const r = await listAmountChanges(s, 'p1')
    expect(r).toEqual([
      {
        id: 'h1',
        previousAmount: 30000,
        newAmount: 50000,
        direction: 'up',
        actor: 'member',
        reason: null,
        createdAt: '2026-04-22T00:00:00Z',
      },
    ])
  })
})
