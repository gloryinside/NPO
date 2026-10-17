import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/toss/keys', () => ({ getOrgTossKeys: vi.fn(async () => ({ tossSecretKey: 'sk' })) }))
vi.mock('@/lib/billing/billing-key-store', () => ({
  sealBillingKey: vi.fn(async (k: string) => `enc:${k}`),
  openBillingKey: vi.fn(async (k: string | null) => (k ? k.replace(/^enc:/, '') : null)),
}))
vi.mock('@/lib/billing/toss-billing', () => ({
  issueBillingKeyByAuth: vi.fn(),
  deleteBillingKey: vi.fn(async () => ({ ok: true })),
}))

import { completeBillingAuth } from '@/lib/billing/complete-billing-auth'
import { issueBillingKeyByAuth, deleteBillingKey } from '@/lib/billing/toss-billing'

const issue = issueBillingKeyByAuth as unknown as ReturnType<typeof vi.fn>
const del = deleteBillingKey as unknown as ReturnType<typeof vi.fn>
const PID = '11111111-1111-1111-1111-111111111111'

function sb(promise: Record<string, unknown> | null, updatedRows: unknown[] = [{ id: PID }]) {
  const q: Record<string, unknown> = {}
  const chain = () => q
  for (const m of ['eq', 'is', 'in', 'select', 'update']) q[m] = chain
  q.maybeSingle = () => Promise.resolve({ data: promise, error: null })
  q.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: updatedRows, error: null }).then(res)
  return { from: () => q } as unknown as SupabaseClient
}

const base = { id: PID, customer_key: 'ck-1', amount: 30000, promise_code: 'PRM-2026-0001', suspended_until: null }

beforeEach(() => {
  issue.mockReset()
  del.mockClear()
  issue.mockResolvedValue({ success: true, billingKey: 'bk-new', customerKey: 'ck-1' })
})

describe('completeBillingAuth', () => {
  it('첫 등록 성공', async () => {
    const r = await completeBillingAuth(sb({ ...base, status: 'pending_billing', toss_billing_key: null }), 'o1', { promiseId: PID, authKey: 'ak', customerKey: 'ck-1' })
    expect(r).toMatchObject({ ok: true, alreadyDone: false })
    expect(issue).toHaveBeenCalledWith('sk', 'ak', 'ck-1')
  })

  it('[보안] customerKey가 신청 때 값과 다르면 발급하지 않는다', async () => {
    const r = await completeBillingAuth(sb({ ...base, status: 'pending_billing', toss_billing_key: null }), 'o1', { promiseId: PID, authKey: 'ak', customerKey: 'other' })
    expect(r).toEqual({ ok: false, reason: 'customer_mismatch' })
    expect(issue).not.toHaveBeenCalled()
  })

  it('새로고침(이미 등록됨)은 다시 발급하지 않고 성공', async () => {
    const r = await completeBillingAuth(sb({ ...base, status: 'active', toss_billing_key: 'enc:bk-old' }), 'o1', { promiseId: PID, authKey: 'ak', customerKey: 'ck-1' })
    expect(r).toMatchObject({ ok: true, alreadyDone: true })
    expect(issue).not.toHaveBeenCalled()
  })

  it('저장 경쟁에서 지면 방금 발급한 키를 토스에서 삭제', async () => {
    await completeBillingAuth(sb({ ...base, status: 'pending_billing', toss_billing_key: null }, []), 'o1', { promiseId: PID, authKey: 'ak', customerKey: 'ck-1' })
    expect(del).toHaveBeenCalledWith('sk', 'bk-new')
  })

  it('카드 변경은 새 키 저장 후 예전 키를 토스에서 삭제', async () => {
    const r = await completeBillingAuth(
      sb({ ...base, status: 'active', toss_billing_key: 'enc:bk-old' }),
      'o1',
      { promiseId: PID, authKey: 'ak', customerKey: 'ck-1' },
      { mode: 'replace', memberId: 'm1' },
    )
    expect(r).toMatchObject({ ok: true, alreadyDone: false })
    expect(del).toHaveBeenCalledWith('sk', 'bk-old')
  })

  it('잘못된 promiseId 형식은 조회 전에 거부', async () => {
    const r = await completeBillingAuth(sb(null), 'o1', { promiseId: "1' or 1=1", authKey: 'ak', customerKey: 'ck' })
    expect(r).toEqual({ ok: false, reason: 'invalid_request' })
  })
})
