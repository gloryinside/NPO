import { describe, it, expect } from 'vitest'
import { feeStatus, nextPeriod, parseFeePayment, parsePlanInput, LIFETIME_UNTIL } from '@/lib/membership/fees'

describe('회비 납부 기간', () => {
  it('남은 기간이 있으면 그 다음 날부터 이어 붙인다', () => {
    expect(nextPeriod('annual', '2025-12-31', '2025-12-20')).toEqual({ start: '2026-01-01', end: '2026-12-31' })
  })
  it('끊겼거나 처음이면 낸 날부터', () => {
    expect(nextPeriod('annual', '2025-01-31', '2025-03-10')).toEqual({ start: '2025-03-10', end: '2026-03-09' })
    expect(nextPeriod('monthly', null, '2025-03-10')).toEqual({ start: '2025-03-10', end: '2025-04-09' })
  })
  it('월말 시작 월회비는 다음 달 말일 하루 전까지', () => {
    expect(nextPeriod('monthly', null, '2025-01-31')).toEqual({ start: '2025-01-31', end: '2025-02-27' })
    expect(nextPeriod('annual', null, '2024-02-29')).toEqual({ start: '2024-02-29', end: '2025-02-27' })
  })
  it('평생 회비', () => {
    expect(nextPeriod('one_time', null, '2025-03-10')).toEqual({ start: '2025-03-10', end: LIFETIME_UNTIL })
  })
})

describe('납부 상태', () => {
  it('만료일 기준 — 30일 안이면 곧 만료', () => {
    expect(feeStatus(null, '2025-06-01')).toBe('unpaid')
    expect(feeStatus('2025-05-31', '2025-06-01')).toBe('overdue')
    expect(feeStatus('2025-06-01', '2025-06-01')).toBe('due_soon')
    expect(feeStatus('2025-07-01', '2025-06-01')).toBe('due_soon')
    expect(feeStatus('2025-07-02', '2025-06-01')).toBe('paid')
  })
})

describe('입력 검증', () => {
  it('회비 종류', () => {
    expect(parsePlanInput({ name: '정회원 연회비', feeAmount: 120000, cycle: 'annual' })).toEqual({ ok: true, value: { name: '정회원 연회비', feeAmount: 120000, cycle: 'annual', description: null } })
    expect(parsePlanInput({ name: '', feeAmount: 1, cycle: 'annual' }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a', feeAmount: 0.5, cycle: 'annual' }).ok).toBe(false)
    expect(parsePlanInput({ name: 'a', feeAmount: 1000, cycle: 'weekly' }).ok).toBe(false)
  })
  it('납부 기록 — 앞날짜·없는 방법은 거절', () => {
    const id = '11111111-1111-4111-8111-111111111111'
    expect(parseFeePayment({ memberId: id, amount: 120000, paidDate: '2025-06-01', method: 'transfer' }, '2025-06-01').ok).toBe(true)
    expect(parseFeePayment({ memberId: id, amount: 120000, paidDate: '2025-06-02', method: 'transfer' }, '2025-06-01').ok).toBe(false)
    expect(parseFeePayment({ memberId: id, amount: 120000, paidDate: '2025-06-01', method: 'bitcoin' }, '2025-06-01').ok).toBe(false)
    expect(parseFeePayment({ memberId: 'x', amount: 120000, paidDate: '2025-06-01', method: 'cash' }, '2025-06-01').ok).toBe(false)
  })
})
