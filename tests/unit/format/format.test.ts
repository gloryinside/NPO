import { describe, it, expect } from 'vitest'
import { formatKRW, formatDate, formatDateTime, formatDateKR } from '@/lib/format'

describe('lib/format', () => {
  it('formatKRW: 천 단위 쉼표 + 원, 빈 값은 -', () => {
    expect(formatKRW(1234567)).toBe('1,234,567원')
    expect(formatKRW('30000')).toBe('30,000원')
    expect(formatKRW(0)).toBe('0원')
    expect(formatKRW(null)).toBe('-')
    expect(formatKRW(undefined)).toBe('-')
    expect(formatKRW('abc')).toBe('-')
  })

  it('formatDate: 한국 시간 기준 — UTC 전날 밤도 한국 날짜로', () => {
    // UTC 10/16 20:00 = KST 10/17 05:00
    expect(formatDate('2026-10-16T20:00:00Z')).toBe('2026. 10. 17.')
    expect(formatDate('2026-10-17')).toBe('2026. 10. 17.')
    expect(formatDate(null)).toBe('-')
    expect(formatDate('not-a-date')).toBe('not-a-date')
  })

  it('formatDateTime: 한국 시간', () => {
    expect(formatDateTime('2026-10-16T20:00:00Z')).toContain('2026. 10. 17.')
    expect(formatDateTime(undefined)).toBe('-')
  })

  it('formatDateKR: 점 구분', () => {
    expect(formatDateKR('2026-04-15T10:00:00Z')).toBe('2026.04.15')
    expect(formatDateKR(null)).toBe('-')
  })
})
