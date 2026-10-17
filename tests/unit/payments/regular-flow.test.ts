import { describe, it, expect } from 'vitest'
import { needsBillingRegistration, resolveRegularFlow } from '@/lib/billing/regular-flow'

const flow = (payMethod: string | undefined, accountBillingEnabled = false, hasCardNumber = false) =>
  resolveRegularFlow({ payMethod, accountBillingEnabled, hasCardNumber })

describe('정기후원 처리 경로', () => {
  it('카드는 결제창 등록, 카드번호가 오면 예전 방식', () => {
    expect(flow('card')).toBe('card_billing')
    expect(flow(undefined)).toBe('card_billing')
    expect(flow('card', false, true)).toBe('card_keyin')
  })

  it('자동이체는 기관이 계좌 자동결제를 켰을 때만 결제창 등록, 아니면 접수 후 외부 CMS', () => {
    expect(flow('cms', false)).toBe('offline')
    expect(flow('cms', true)).toBe('account_billing')
    expect(flow('transfer', true)).toBe('offline')
    expect(flow('manual')).toBe('offline')
  })

  it('정기 청구 수단이 없는 결제수단은 받지 않는다', () => {
    expect(flow('kakaopay')).toBe('unsupported')
    expect(flow('virtual')).toBe('unsupported')
  })

  it('결제창 등록이 필요한 경로', () => {
    expect(needsBillingRegistration('card_billing')).toBe(true)
    expect(needsBillingRegistration('account_billing')).toBe(true)
    expect(needsBillingRegistration('offline')).toBe(false)
    expect(needsBillingRegistration('card_keyin')).toBe(false)
  })
})
