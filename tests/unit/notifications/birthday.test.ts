import { describe, it, expect } from 'vitest'
import { resolveBirthdayMatches, extractMonthDay } from '@/lib/notifications/birthday'

describe('resolveBirthdayMatches', () => {
  it('평범한 날: 오늘 MM-DD 한 개', () => {
    // 2026-04-23 09:00 UTC → KST 2026-04-23 18:00
    const matches = resolveBirthdayMatches(new Date('2026-04-23T09:00:00Z'))
    expect(matches).toEqual(['04-23'])
  })

  it('KST 자정 직후: 이전 UTC 날짜여도 KST 새 날짜', () => {
    // 2026-04-23 00:10 KST = 2026-04-22 15:10 UTC
    const matches = resolveBirthdayMatches(new Date('2026-04-22T15:10:00Z'))
    expect(matches).toEqual(['04-23'])
  })

  it('비윤년 3/1: 2/29 + 3/1 두 매칭', () => {
    // 2026-03-01 KST (2026은 비윤년)
    const matches = resolveBirthdayMatches(new Date('2026-03-01T00:30:00Z'))
    expect(matches.sort()).toEqual(['02-29', '03-01'])
  })

  it('윤년 3/1: 3/1만 매칭 (2/29 생일자는 전날 발송됨)', () => {
    // 2024-03-01 KST (2024는 윤년)
    const matches = resolveBirthdayMatches(new Date('2024-03-01T00:30:00Z'))
    expect(matches).toEqual(['03-01'])
  })
})

describe('extractMonthDay', () => {
  it('정상 포맷에서 MM-DD 추출', () => {
    expect(extractMonthDay('1990-04-23')).toBe('04-23')
    expect(extractMonthDay('1988-02-29')).toBe('02-29')
  })

  it('null/undefined/빈값 → null', () => {
    expect(extractMonthDay(null)).toBeNull()
    expect(extractMonthDay(undefined)).toBeNull()
    expect(extractMonthDay('')).toBeNull()
  })

  it('잘못된 포맷 → null', () => {
    expect(extractMonthDay('1990/04/23')).toBeNull()
    expect(extractMonthDay('90-04-23')).toBeNull()
    expect(extractMonthDay('1990-4-23')).toBeNull()
  })
})
