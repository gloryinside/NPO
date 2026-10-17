import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/erp/payload-builder', () => ({
  buildErpPaymentPayload: vi.fn(async () => {
    throw new Error('payload boom')
  }),
}))

import { queueErpPaymentEvent, queueErpReceiptEvent } from '@/lib/erp/outbound-queue'

const brokenSupabase = {
  from: () => {
    throw new Error('db down')
  },
} as unknown as SupabaseClient

describe('ERP 이벤트 큐 적재', () => {
  it('[안전] 페이로드·DB 오류가 나도 예외를 던지지 않는다(결제·환불 처리를 깨지 않음)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(queueErpPaymentEvent(brokenSupabase, 'o1', 'p1', 'payment.paid')).resolves.toBeUndefined()
    await expect(
      queueErpReceiptEvent(brokenSupabase, 'o1', { receiptCode: 'RCP-2026-00001', memberId: 'm1', year: 2026, totalAmount: 1000, issuedAt: '2027-01-05T00:00:00Z' }),
    ).resolves.toBeUndefined()
    expect(err).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })
})
