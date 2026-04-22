import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createManualPayment,
  MIN_MANUAL_AMOUNT,
  MAX_MANUAL_AMOUNT,
} from '@/lib/payments/manual-create'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * createManualPayment는 순차적으로 다음 호출을 한다:
 *   1. promises.select({count, head}).eq(org_id)          → count
 *   2. promises.insert(...).select(id).single()            → {id}
 *   3. payments.select({count, head}).eq(org_id)           → count
 *   4. payments.insert(...).select(id).single()            → {id}
 * 실패 시:
 *   5. promises.delete().eq(id)                            → rollback
 */
function createStub(opts: {
  promiseCount?: number
  promiseInsert?: { data: { id: string } | null; error: Error | null }
  paymentCount?: number
  paymentInsert?: { data: { id: string } | null; error: Error | null }
}) {
  const deleteSpy = vi.fn(() => ({
    eq: () => Promise.resolve({ error: null }),
  }))

  function makeChain(table: 'promises' | 'payments') {
    const select = vi.fn().mockImplementation((cols: string, opts2?: { count?: string; head?: boolean }) => {
      // count 조회 (head:true)
      if (opts2?.head) {
        return {
          eq: () =>
            Promise.resolve({
              count:
                table === 'promises'
                  ? (opts.promiseCount ?? 0)
                  : (opts.paymentCount ?? 0),
              error: null,
            }),
        }
      }
      // insert select chain
      return {
        single: () =>
          Promise.resolve(
            table === 'promises'
              ? (opts.promiseInsert ?? { data: { id: 'prom-1' }, error: null })
              : (opts.paymentInsert ?? { data: { id: 'pay-1' }, error: null })
          ),
      }
    })

    const insertFn = vi.fn(() => ({
      select: () => ({
        single: () =>
          Promise.resolve(
            table === 'promises'
              ? (opts.promiseInsert ?? { data: { id: 'prom-1' }, error: null })
              : (opts.paymentInsert ?? { data: { id: 'pay-1' }, error: null })
          ),
      }),
    }))

    return {
      select,
      insert: insertFn,
      delete: deleteSpy,
    }
  }

  const tableSpies = {
    promises: makeChain('promises'),
    payments: makeChain('payments'),
  }

  const sb = {
    from: vi.fn((t: 'promises' | 'payments') => tableSpies[t]),
  } as unknown as SupabaseClient

  return { sb, deleteSpy, tableSpies }
}

describe('createManualPayment 입력 검증', () => {
  const base = {
    orgId: 'o1',
    memberId: 'm1',
    payDate: '2026-04-22',
    payMethod: 'cash' as const,
  }

  it('amount 0은 INVALID_AMOUNT', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({ supabase: sb, ...base, amount: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_AMOUNT')
  })

  it('MIN 미만은 INVALID_AMOUNT', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({
      supabase: sb,
      ...base,
      amount: MIN_MANUAL_AMOUNT - 1,
    })
    expect(r.ok).toBe(false)
  })

  it('MAX 초과는 INVALID_AMOUNT', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({
      supabase: sb,
      ...base,
      amount: MAX_MANUAL_AMOUNT + 1,
    })
    expect(r.ok).toBe(false)
  })

  it('NaN도 INVALID_AMOUNT', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({
      supabase: sb,
      ...base,
      amount: Number.NaN,
    })
    expect(r.ok).toBe(false)
  })

  it('잘못된 날짜는 INVALID_DATE', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({
      supabase: sb,
      ...base,
      amount: 50000,
      payDate: '2026-13-99',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_DATE')
  })

  it('비허용 pay_method는 INVALID_METHOD', async () => {
    const { sb } = createStub({})
    const r = await createManualPayment({
      supabase: sb,
      ...base,
      amount: 50000,
      // @ts-expect-error 의도적 잘못된 값
      payMethod: 'card',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_METHOD')
  })
})

describe('createManualPayment 성공 흐름', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T10:00:00Z'))
  })

  it('정상 입력 → promises+payments insert + ok:true', async () => {
    const { sb, tableSpies } = createStub({
      promiseCount: 10,
      paymentCount: 100,
    })
    const r = await createManualPayment({
      supabase: sb,
      orgId: 'o1',
      memberId: 'm1',
      amount: 50000,
      payDate: '2026-04-22',
      payMethod: 'cash',
      note: '현장 모금',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.paymentId).toBe('pay-1')
      expect(r.promiseId).toBe('prom-1')
      expect(r.paymentCode).toMatch(/^PMT-2026\d{5}$/)
    }
    expect(tableSpies.promises.insert).toHaveBeenCalledTimes(1)
    expect(tableSpies.payments.insert).toHaveBeenCalledTimes(1)
  })
})

describe('createManualPayment 롤백 흐름', () => {
  it('promises.insert 실패 → payments.insert 호출 안 됨', async () => {
    const { sb, tableSpies } = createStub({
      promiseInsert: { data: null, error: new Error('promise insert fail') },
    })
    const r = await createManualPayment({
      supabase: sb,
      orgId: 'o1',
      memberId: 'm1',
      amount: 50000,
      payDate: '2026-04-22',
      payMethod: 'cash',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INSERT_FAILED')
    expect(tableSpies.payments.insert).not.toHaveBeenCalled()
  })

  it('payments.insert 실패 → promises.delete 호출 (롤백)', async () => {
    const { sb, deleteSpy } = createStub({
      paymentInsert: { data: null, error: new Error('payment insert fail') },
    })
    const r = await createManualPayment({
      supabase: sb,
      orgId: 'o1',
      memberId: 'm1',
      amount: 50000,
      payDate: '2026-04-22',
      payMethod: 'cash',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INSERT_FAILED')
    expect(deleteSpy).toHaveBeenCalledTimes(1)
  })
})
