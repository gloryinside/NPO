import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/billing/billing-key-store', () => ({
  openBillingKey: vi.fn(async (v: string | null) => v),
}))

import { chargeBillingKey, toTossOrderId } from '@/lib/billing/toss-billing'
import { chargePayment } from '@/lib/billing/charge-one'

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

const okJson = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response)

describe('toTossOrderId — 토스 orderId 규칙(영문·숫자·-·_ 6~64자)', () => {
  it('허용 안 되는 문자는 -로, 짧으면 채우고 길면 자른다', () => {
    expect(toTossOrderId('PMT-2026 0001/R1')).toBe('PMT-2026-0001-R1')
    expect(toTossOrderId('AB')).toBe('AB0000')
    expect(toTossOrderId('x'.repeat(80))).toHaveLength(64)
  })
})

describe('chargeBillingKey — 승인 검증', () => {
  const params = { customerKey: 'ck', amount: 30000, orderId: 'PMT-1', orderName: '정기후원', idempotencyKey: 'npo-charge-p1-0' }

  it('Idempotency-Key 헤더를 보낸다', async () => {
    fetchMock.mockReturnValue(okJson({ status: 'DONE', paymentKey: 'pk', totalAmount: 30000 }))
    await chargeBillingKey('sk', 'bk', params)
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Idempotency-Key']).toBe('npo-charge-p1-0')
    expect(JSON.parse(init.body).idempotencyKey).toBeUndefined()
  })

  it('DONE + 금액 일치만 성공', async () => {
    fetchMock.mockReturnValue(okJson({ status: 'DONE', paymentKey: 'pk', totalAmount: 30000 }))
    expect((await chargeBillingKey('sk', 'bk', params)).success).toBe(true)
  })

  it('[보안] 승인 금액이 다르면 실패 + 재시도 금지', async () => {
    fetchMock.mockReturnValue(okJson({ status: 'DONE', paymentKey: 'pk', totalAmount: 1000 }))
    const r = await chargeBillingKey('sk', 'bk', params)
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.failureCode).toBe('AMOUNT_MISMATCH')
      expect(r.retryable).toBe(false)
    }
  })

  it('카드 정지 등 영구 실패는 재시도하지 않는다', async () => {
    fetchMock.mockReturnValue(okJson({ code: 'INVALID_STOPPED_CARD', message: '정지된 카드' }, 400))
    const r = await chargeBillingKey('sk', 'bk', params)
    expect(!r.success && r.retryable).toBe(false)
  })

  it('네트워크 오류는 재시도 가능(같은 멱등키로 결과 회수)', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'))
    const r = await chargeBillingKey('sk', 'bk', params)
    expect(!r.success && r.failureCode).toBe('NETWORK_ERROR')
    expect(!r.success && r.retryable).toBe(true)
  })
})

/** 호출을 기록하는 최소 supabase 쿼리 빌더 */
function fakeSupabase(opts: { claimRows: unknown[]; row?: unknown }) {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = []
  const builder = (table: string) => {
    let op: 'select' | 'update' = 'select'
    let patch: Record<string, unknown> = {}
    const q: Record<string, unknown> = {}
    const chain = () => q
    for (const m of ['eq', 'in', 'is', 'or', 'not', 'lte', 'lt']) q[m] = chain
    q.update = (p: Record<string, unknown>) => {
      op = 'update'
      patch = p
      updates.push({ table, patch: p })
      return q
    }
    q.select = () => q
    q.single = () => Promise.resolve({ data: opts.row ?? null, error: opts.row ? null : { message: 'nf' } })
    q.then = (res: (v: unknown) => unknown) => {
      // 선점 UPDATE(.select('id')) 결과 = claimRows, 그 밖의 update는 성공
      const isClaim = op === 'update' && 'charging_started_at' in patch && Object.keys(patch).length === 1
      return Promise.resolve(isClaim ? { data: opts.claimRows, error: null } : { data: null, error: null }).then(res)
    }
    return q
  }
  return { client: { from: vi.fn(builder) } as unknown as SupabaseClient, updates }
}

const row = (over: Record<string, unknown> = {}) => ({
  id: 'p1', org_id: 'o1', member_id: 'm1', amount: 30000, payment_code: 'PMT-2026000001', retry_count: 0, pay_status: 'unpaid',
  promises: { id: 'pr1', status: 'active', toss_billing_key: 'bk', customer_key: 'ck' },
  ...over,
})

describe('chargePayment — 이중 결제 방지·상태 전이', () => {
  it('[보안] 선점 실패(다른 곳에서 처리 중)면 토스를 호출하지 않는다', async () => {
    const { client } = fakeSupabase({ claimRows: [] })
    const r = await chargePayment(client, 'sk', { paymentId: 'p1', orgId: 'o1' }, 'auto')
    expect(r).toEqual({ kind: 'skipped', reason: 'already_processing_or_done' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('자동 경로는 해지·정지 약정을 청구하지 않는다', async () => {
    const { client } = fakeSupabase({ claimRows: [{ id: 'p1' }], row: row({ promises: { id: 'pr1', status: 'cancelled', toss_billing_key: 'bk', customer_key: 'ck' } }) })
    const r = await chargePayment(client, 'sk', { paymentId: 'p1', orgId: 'o1' }, 'auto')
    expect(r.kind).toBe('skipped')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('성공 → paid 기록, 선점 해제', async () => {
    fetchMock.mockReturnValue(okJson({ status: 'DONE', paymentKey: 'pk', totalAmount: 30000, approvedAt: '2026-10-16T09:00:00+09:00' }))
    const { client, updates } = fakeSupabase({ claimRows: [{ id: 'p1' }], row: row() })
    const r = await chargePayment(client, 'sk', { paymentId: 'p1', orgId: 'o1' }, 'auto')
    expect(r.kind).toBe('paid')
    const last = updates.at(-1)!.patch
    expect(last.pay_status).toBe('paid')
    expect(last.charging_started_at).toBeNull()
    expect(last.toss_order_id).toBe('PMT-2026000001')
  })

  it('3번째 실패 → 약정 정지', async () => {
    fetchMock.mockReturnValue(okJson({ code: 'REJECT_CARD_COMPANY', message: '한도 초과' }, 400))
    const { client, updates } = fakeSupabase({ claimRows: [{ id: 'p1' }], row: row({ retry_count: 2, pay_status: 'failed' }) })
    const r = await chargePayment(client, 'sk', { paymentId: 'p1', orgId: 'o1' }, 'auto')
    expect(r.kind).toBe('suspended')
    expect(updates.some((u) => u.table === 'promises' && u.patch.status === 'suspended')).toBe(true)
    // 재시도 차수가 orderId·멱등키에 반영
    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body).orderId).toBe('PMT-2026000001-R2')
    expect(init.headers['Idempotency-Key']).toBe('npo-charge-p1-2')
  })

  it('네트워크 오류는 시도 번호를 올리지 않는다(같은 멱등키로 다시)', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'))
    const { client, updates } = fakeSupabase({ claimRows: [{ id: 'p1' }], row: row() })
    const r = await chargePayment(client, 'sk', { paymentId: 'p1', orgId: 'o1' }, 'auto')
    expect(r.kind).toBe('unknown')
    expect(updates.some((u) => 'retry_count' in u.patch)).toBe(false)
  })
})
