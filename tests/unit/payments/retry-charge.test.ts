import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

// chargeBillingKey / getOrgTossKeys mock — import 전에 정의
vi.mock('@/lib/billing/toss-billing', () => ({
  chargeBillingKey: vi.fn(),
}))
vi.mock('@/lib/toss/keys', () => ({
  getOrgTossKeys: vi.fn(),
}))

import { retryChargePayment } from '@/lib/payments/retry-charge'
import { chargeBillingKey } from '@/lib/billing/toss-billing'
import { getOrgTossKeys } from '@/lib/toss/keys'

const mockedCharge = chargeBillingKey as unknown as ReturnType<typeof vi.fn>
const mockedKeys = getOrgTossKeys as unknown as ReturnType<typeof vi.fn>

/**
 * rate-limit은 모듈-레벨 Map을 쓰므로 케이스마다 unique paymentId/memberId 사용.
 */

function makeSupabase(opts: {
  row: unknown
  updateSpy?: ReturnType<typeof vi.fn>
}): SupabaseClient {
  const update = opts.updateSpy ?? vi.fn(() => ({
    eq: () => Promise.resolve({ error: null }),
  }))
  const selectChain = {
    eq: () => selectChain,
    maybeSingle: () => Promise.resolve({ data: opts.row, error: null }),
  } as Record<string, unknown>
  return {
    from: vi.fn(() => ({
      select: () => selectChain,
      update,
    })),
  } as unknown as SupabaseClient
}

beforeEach(() => {
  mockedCharge.mockReset()
  mockedKeys.mockReset()
  mockedKeys.mockResolvedValue({ tossSecretKey: 'secret-abc' })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('retryChargePayment 사전 검증', () => {
  it('payment 없음 → NOT_FOUND', async () => {
    const sb = makeSupabase({ row: null })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-not-found-1',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('NOT_FOUND')
  })

  it('pay_status=paid → INVALID_STATUS', async () => {
    const sb = makeSupabase({
      row: {
        id: 'pay-status-1',
        member_id: 'm1',
        pay_status: 'paid',
        payment_code: 'PMT-1',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      },
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-status-1',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_STATUS')
  })

  it('billingKey 없음 → BILLING_KEY_MISSING', async () => {
    const sb = makeSupabase({
      row: {
        id: 'pay-nobill-1',
        member_id: 'm1',
        pay_status: 'failed',
        payment_code: 'PMT-1',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: null, customer_key: null },
      },
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-nobill-1',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('BILLING_KEY_MISSING')
  })

  it('promises null → BILLING_KEY_MISSING', async () => {
    const sb = makeSupabase({
      row: {
        id: 'pay-nopromise-1',
        member_id: 'm1',
        pay_status: 'unpaid',
        payment_code: 'PMT-1',
        amount: 50000,
        org_id: 'o1',
        promises: null,
      },
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-nopromise-1',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('BILLING_KEY_MISSING')
  })

  it('Toss secret 없음 → TOSS_UNAVAILABLE', async () => {
    mockedKeys.mockResolvedValue({ tossSecretKey: null })
    const sb = makeSupabase({
      row: {
        id: 'pay-nokey-1',
        member_id: 'm-unique-nokey',
        pay_status: 'failed',
        payment_code: 'PMT-1',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      },
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-nokey-1',
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('TOSS_UNAVAILABLE')
  })
})

describe('retryChargePayment Toss 호출 결과', () => {
  it('성공 시 payments.update({pay_status:paid}) 호출 + success:true', async () => {
    mockedCharge.mockResolvedValue({ success: true, paymentKey: 'tpk-123' })
    const updateSpy: ReturnType<typeof vi.fn> = vi.fn(
      (_arg: Record<string, unknown>) => ({
        eq: () => Promise.resolve({ error: null }),
      })
    )
    const sb = makeSupabase({
      row: {
        id: 'pay-ok-1',
        member_id: 'm-ok-1',
        pay_status: 'failed',
        payment_code: 'PMT-OK',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      },
      updateSpy,
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-ok-1',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.success).toBe(true)
      expect(r.tossPaymentKey).toBe('tpk-123')
    }
    expect(updateSpy).toHaveBeenCalledTimes(1)
    const updateArg = updateSpy.mock.calls[0]?.[0] as unknown as {
      pay_status: string
    }
    expect(updateArg.pay_status).toBe('paid')
  })

  it('실패 시 payments.update({pay_status:failed, fail_reason}) + success:false', async () => {
    mockedCharge.mockResolvedValue({
      success: false,
      failureCode: 'INSUFFICIENT_FUNDS',
      failureMessage: '카드 한도 초과',
    })
    const updateSpy: ReturnType<typeof vi.fn> = vi.fn(
      (_arg: Record<string, unknown>) => ({
        eq: () => Promise.resolve({ error: null }),
      })
    )
    const sb = makeSupabase({
      row: {
        id: 'pay-fail-1',
        member_id: 'm-fail-1',
        pay_status: 'failed',
        payment_code: 'PMT-FAIL',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      },
      updateSpy,
    })
    const r = await retryChargePayment({
      supabase: sb,
      orgId: 'o1',
      paymentId: 'pay-fail-1',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.success).toBe(false)
      expect(r.message).toBe('카드 한도 초과')
    }
    expect(updateSpy).toHaveBeenCalledTimes(1)
    const updateArg = updateSpy.mock.calls[0]?.[0] as unknown as {
      pay_status: string
      fail_reason: string
    }
    expect(updateArg.pay_status).toBe('failed')
    expect(updateArg.fail_reason).toBe('카드 한도 초과')
  })
})

describe('retryChargePayment rate limit', () => {
  it('payment 기준 5회 초과 시 6번째는 RATE_LIMITED', async () => {
    mockedCharge.mockResolvedValue({ success: true, paymentKey: 'tpk' })

    // 각 호출마다 member_id는 unique — member 한도를 건드리지 않고 payment 한도만 검증
    for (let i = 0; i < 5; i++) {
      const row = {
        id: 'pay-rl-shared',
        member_id: `m-rl-payment-${i}`,
        pay_status: 'failed',
        payment_code: 'PMT',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      }
      const sb = makeSupabase({ row })
      const r = await retryChargePayment({
        supabase: sb,
        orgId: 'o1',
        paymentId: 'pay-rl-shared',
      })
      expect(r.ok).toBe(true)
    }

    const row6 = {
      id: 'pay-rl-shared',
      member_id: 'm-rl-payment-6',
      pay_status: 'failed',
      payment_code: 'PMT',
      amount: 50000,
      org_id: 'o1',
      promises: { toss_billing_key: 'bk', customer_key: 'ck' },
    }
    const sb6 = makeSupabase({ row: row6 })
    const r6 = await retryChargePayment({
      supabase: sb6,
      orgId: 'o1',
      paymentId: 'pay-rl-shared',
    })
    expect(r6.ok).toBe(false)
    if (!r6.ok) expect(r6.error).toBe('RATE_LIMITED')
  })

  it('member 기준 3회 초과 시 4번째는 RATE_LIMITED (paymentId는 달라도)', async () => {
    mockedCharge.mockResolvedValue({ success: true, paymentKey: 'tpk' })

    // 같은 member, 다른 payment 3회 → 허용
    for (let i = 0; i < 3; i++) {
      const row = {
        id: `pay-member-rl-${i}`,
        member_id: 'm-rl-shared',
        pay_status: 'failed',
        payment_code: 'PMT',
        amount: 50000,
        org_id: 'o1',
        promises: { toss_billing_key: 'bk', customer_key: 'ck' },
      }
      const sb = makeSupabase({ row })
      const r = await retryChargePayment({
        supabase: sb,
        orgId: 'o1',
        paymentId: `pay-member-rl-${i}`,
      })
      expect(r.ok).toBe(true)
    }

    // 4번째는 member 한도로 차단
    const row4 = {
      id: 'pay-member-rl-3',
      member_id: 'm-rl-shared',
      pay_status: 'failed',
      payment_code: 'PMT',
      amount: 50000,
      org_id: 'o1',
      promises: { toss_billing_key: 'bk', customer_key: 'ck' },
    }
    const sb4 = makeSupabase({ row: row4 })
    const r4 = await retryChargePayment({
      supabase: sb4,
      orgId: 'o1',
      paymentId: 'pay-member-rl-3',
    })
    expect(r4.ok).toBe(false)
    if (!r4.ok) expect(r4.error).toBe('RATE_LIMITED')
  })
})
