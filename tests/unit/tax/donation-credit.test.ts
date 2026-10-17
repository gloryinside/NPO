import { describe, it, expect } from 'vitest'
import { estimateDonationCredit } from '@/lib/tax/donation-credit'

describe('기부금 세액공제 예상', () => {
  it('정기 월 3만원 = 연 36만원, 15% + 지방소득세 10%', () => {
    expect(estimateDonationCredit(30000, 'regular')).toEqual({ annual: 360000, incomeTax: 54000, localTax: 5400, total: 59000 })
  })

  it('일시 후원은 그 금액만', () => {
    expect(estimateDonationCredit(100000, 'onetime')?.incomeTax).toBe(15000)
  })

  it('1천만원 초과분은 30%', () => {
    expect(estimateDonationCredit(12_000_000, 'onetime')?.incomeTax).toBe(1_500_000 + 600_000)
  })

  it('금액이 없으면 계산하지 않는다', () => {
    expect(estimateDonationCredit(0, 'regular')).toBeNull()
    expect(estimateDonationCredit(Number.NaN, 'regular')).toBeNull()
  })
})
