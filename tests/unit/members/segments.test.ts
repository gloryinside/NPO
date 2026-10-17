import { describe, it, expect } from 'vitest'
import { describeSegment, parseSegmentFilter, parseSegmentName, safeCsvText } from '@/lib/members/segments'

describe('후원자 명단 조건', () => {
  it('아는 키와 허용 범위만 남긴다', () => {
    const f = parseSegmentFilter({
      status: 'active',
      tiers: ['gold', 'gold', 'emperor'],
      unpaid_min: '2',
      regular_months_min: 0,
      last_gift_days_min: 99999,
      birthday_month: 13,
      join_path: 'SNS',
      tag_id: 'not-a-uuid',
      pay_method: 'bitcoin',
      evil: "'; drop table members; --",
    })
    expect(f).toEqual({ status: 'active', tiers: ['gold'], unpaid_min: 2, join_path: 'SNS' })
  })

  it('빈 값이면 조건 없음', () => {
    expect(parseSegmentFilter(null)).toEqual({})
    expect(parseSegmentFilter({ tiers: [] })).toEqual({})
  })

  it('조건을 사람이 읽는 말로', () => {
    expect(describeSegment({})).toEqual(['모든 후원자'])
    expect(
      describeSegment({ has_active_regular: true, regular_months_min: 24, unpaid_min: 2, tag_id: 't1', pay_method: 'cms' }, { t1: 'VIP' }),
    ).toEqual(['정기후원 중', '자동이체(CMS)로 후원', '정기후원 2년 이상', '최근 6개월 미납 2회 이상', '분류: VIP'])
    expect(describeSegment({ regular_months_min: 6 })).toEqual(['정기후원 6개월 이상'])
  })

  it('이름은 1~60자', () => {
    expect(parseSegmentName('  미납자  ')).toBe('미납자')
    expect(parseSegmentName('')).toBeNull()
    expect(parseSegmentName('가'.repeat(61))).toBeNull()
  })

  it('엑셀 수식처럼 시작하는 값은 글자로', () => {
    expect(safeCsvText('=HYPERLINK("x")')).toBe(`'=HYPERLINK("x")`)
    expect(safeCsvText('김후원')).toBe('김후원')
    expect(safeCsvText(null)).toBe('')
  })
})
