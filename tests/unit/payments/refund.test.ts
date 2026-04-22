import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/toss/keys', () => ({
  getOrgTossKeys: vi.fn(),
}))

import { refundPayment } from '@/lib/payments/refund'
import { getOrgTossKeys } from '@/lib/toss/keys'

const mockedKeys = getOrgTossKeys as unknown as ReturnType<typeof vi.fn>

const BASE_PAYMENT = {
  id: 'pay-1',
  org_id: 'org-1',
  amount: 100000,
  pay_status: 'paid',
  toss_payment_key: 'toss-key-abc',
}

type UpdateChain = { eq: () => UpdateChain; select: () => Promise<{ error: unknown }> }
type SelectChain = { eq: () => SelectChain; maybeSingle: () => Promise<{ data: unknown; error: null }> }

function makeSupabase(opts: {
  row: unknown
  updateError?: unknown
}): SupabaseClient {
  const updateChain: UpdateChain = {
    eq: () => updateChain,
    select: () => Promise.resolve({ error: opts.updateError ?? null }),
  }
  const selectChain: SelectChain = {
    eq: () => selectChain,
    maybeSingle: () => Promise.resolve({ data: opts.row, error: null }),
  }
  return {
    from: vi.fn(() => ({
      select: () => selectChain,
      update: () => updateChain,
    })),
  } as unknown as SupabaseClient
}

beforeEach(() => {
  mockedKeys.mockReset()
  mockedKeys.mockResolvedValue({ tossSecretKey: 'secret-test' })
})

describe('refundPayment 사전 검증', () => {
  it('payment 없음 → NOT_FOUND', async () => {
    const sb = makeSupabase({ row: null })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'x', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('NOT_FOUND')
  })

  it('pay_status !== paid → INVALID_STATUS', async () => {
    const sb = makeSupabase({ row: { ...BASE_PAYMENT, pay_status: 'refunded' } })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_STATUS')
  })

  it('toss_payment_key 없음 → OFFLINE_PAYMENT', async () => {
    const sb = makeSupabase({ row: { ...BASE_PAYMENT, toss_payment_key: null } })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('OFFLINE_PAYMENT')
  })

  it('refundAmount > amount → INVALID_AMOUNT', async () => {
    const sb = makeSupabase({ row: BASE_PAYMENT })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other', refundAmount: 200000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_AMOUNT')
  })

  it('refundAmount <= 0 → INVALID_AMOUNT', async () => {
    const sb = makeSupabase({ row: BASE_PAYMENT })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other', refundAmount: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_AMOUNT')
  })

  it('Toss API 실패 → TOSS_FAILED, DB 변경 없음', async () => {
    const updateSpy = vi.fn()
    const selectChain: SelectChain = {
      eq: () => selectChain,
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: '취소 불가' }),
    }) as unknown as typeof fetch

    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'error' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('TOSS_FAILED')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('전액 환불 성공 → refund_amount null, pay_status refunded', async () => {
    const capturedUpdate: unknown[] = []
    const updateChain: UpdateChain = {
      eq: () => updateChain,
      select: () => Promise.resolve({ error: null }),
    }
    const updateSpy = vi.fn((data: unknown) => {
      capturedUpdate.push(data)
      return updateChain
    })
    const selectChain: SelectChain = {
      eq: () => selectChain,
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'donor_request' })
    expect(r.ok).toBe(true)
    const updated = capturedUpdate[0] as Record<string, unknown>
    expect(updated.pay_status).toBe('refunded')
    expect(updated.refund_amount).toBeNull()
    expect(updated.cancel_reason).toBe('donor_request')
  })

  it('부분 환불 성공 → refund_amount=50000, cancel_reason 포함', async () => {
    const capturedUpdate: unknown[] = []
    const updateChain: UpdateChain = {
      eq: () => updateChain,
      select: () => Promise.resolve({ error: null }),
    }
    const updateSpy = vi.fn((data: unknown) => {
      capturedUpdate.push(data)
      return updateChain
    })
    const selectChain: SelectChain = {
      eq: () => selectChain,
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const r = await refundPayment({
      supabase: sb, orgId: 'org-1', paymentId: 'pay-1',
      reasonCode: 'duplicate', reasonNote: '이중청구', refundAmount: 50000,
    })
    expect(r.ok).toBe(true)
    const updated = capturedUpdate[0] as Record<string, unknown>
    expect(updated.refund_amount).toBe(50000)
    expect(updated.cancel_reason).toBe('duplicate:이중청구')
  })
})
