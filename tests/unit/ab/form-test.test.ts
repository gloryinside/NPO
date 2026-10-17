import { describe, it, expect } from 'vitest'
import { assignVariant, compareVariants, isVisitorId, parseVariants } from '@/lib/ab/form-test'

describe('A/B 배정', () => {
  it('같은 방문자는 늘 같은 안, 전체로는 반반에 가깝다', () => {
    const t = '11111111-1111-4111-8111-111111111111'
    expect(assignVariant(t, 'visitor-abcdef-0001')).toBe(assignVariant(t, 'visitor-abcdef-0001'))
    let b = 0
    for (let i = 0; i < 4000; i++) if (assignVariant(t, `v-${i}-xxxxxxxxxxxx`) === 'B') b++
    expect(b / 4000).toBeGreaterThan(0.45)
    expect(b / 4000).toBeLessThan(0.55)
  })
  it('방문자 id 모양', () => {
    expect(isVisitorId('3f2b1c9e-0000-4000-8000-123456789abc')).toBe(true)
    expect(isVisitorId('short')).toBe(false)
    expect(isVisitorId('<script>alert(1)</script>xx')).toBe(false)
  })
})

describe('안 설정', () => {
  it('A는 캠페인 그대로, B는 바꿔 볼 금액 버튼', () => {
    expect(parseVariants([{ amountPresets: [] }, { amountPresets: [5000, 10000, 30000], defaultType: 'regular' }])).toEqual({
      ok: true,
      value: [
        { key: 'A', amountPresets: [], defaultType: null },
        { key: 'B', amountPresets: [5000, 10000, 30000], defaultType: 'regular' },
      ],
    })
  })
  it('같은 안·잘못된 금액은 거절', () => {
    expect(parseVariants([{}, {}]).ok).toBe(false)
    expect(parseVariants([{}, { amountPresets: [500, 1000] }]).ok).toBe(false)
    expect(parseVariants([{}, { amountPresets: [1000, 1000] }]).ok).toBe(false)
    expect(parseVariants([{}, { amountPresets: [1000] }]).ok).toBe(false)
    expect(parseVariants([{}]).ok).toBe(false)
  })
})

describe('결과 판정', () => {
  it('표본이 적으면 판정하지 않는다', () => {
    const r = compareVariants({ views: 50, conversions: 5, amount: 50000 }, { views: 50, conversions: 10, amount: 100000 })
    expect(r).toMatchObject({ enoughData: false, pValue: null, leader: null })
    expect(r.rate).toEqual({ A: 0.1, B: 0.2 })
  })
  it('차이가 크면 앞선 안을 알려 준다', () => {
    const r = compareVariants({ views: 1000, conversions: 50, amount: 1_500_000 }, { views: 1000, conversions: 90, amount: 2_000_000 })
    expect(r.leader).toBe('B')
    expect(r.pValue!).toBeLessThan(0.01)
    expect(r.avgAmount).toEqual({ A: 30000, B: 22222 })
  })
  it('차이가 작으면 판정 보류', () => {
    const r = compareVariants({ views: 1000, conversions: 50, amount: 0 }, { views: 1000, conversions: 55, amount: 0 })
    expect(r.leader).toBeNull()
    expect(r.pValue!).toBeGreaterThan(0.05)
  })
})
