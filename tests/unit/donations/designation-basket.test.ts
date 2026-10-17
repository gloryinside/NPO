import { describe, it, expect } from 'vitest'
import { allocateSplit, parseBasket, readSplit, scaleSplit, singleDesignation } from '@/lib/donations/designation-basket'

const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const options = [
  { key: 'edu', label: '아동 교육', programId: P1 },
  { key: 'food', label: '결식 지원', programId: P2 },
  { key: 'free', label: '어디든 필요한 곳' },
]

describe('여러 사업 담기', () => {
  it('설정에 있는 사업만, 사업마다 1,000원 이상', () => {
    const r = parseBasket([{ key: 'edu', amount: 20000 }, { key: 'free', amount: 5000 }], options)
    expect(r).toEqual({
      ok: true,
      total: 25000,
      items: [
        { key: 'edu', label: '아동 교육', amount: 20000, programId: P1 },
        { key: 'free', label: '어디든 필요한 곳', amount: 5000, programId: null },
      ],
    })
    expect(parseBasket([{ key: 'hack', amount: 10000 }], options).ok).toBe(false)
    expect(parseBasket([{ key: 'edu', amount: 500 }], options).ok).toBe(false)
    expect(parseBasket([{ key: 'edu', amount: 1000.5 }], options).ok).toBe(false)
    expect(parseBasket([{ key: 'edu', amount: 1000 }, { key: 'edu', amount: 1000 }], options).ok).toBe(false)
    expect(parseBasket([], options).ok).toBe(false)
    expect(parseBasket('x', options).ok).toBe(false)
  })

  it('라벨·사업 연결은 신청서가 아니라 설정에서 가져온다', () => {
    const r = parseBasket([{ key: 'edu', amount: 10000, label: '가짜', programId: P2 }], options)
    expect(r.ok && r.items[0]).toMatchObject({ label: '아동 교육', programId: P1 })
  })

  it('목적 하나 고르기도 설정에 있는 값만 받는다', () => {
    expect(singleDesignation('food', options)?.label).toBe('결식 지원')
    expect(singleDesignation('<script>', options)).toBeNull()
    expect(singleDesignation(undefined, options)).toBeNull()
  })

  it('금액이 바뀐 정기후원도 고른 비율대로 나누고 합계가 정확하다', () => {
    const split = [
      { key: 'edu', label: '아동 교육', amount: 10000, programId: P1 },
      { key: 'food', label: '결식 지원', amount: 20000, programId: P2 },
    ]
    expect(scaleSplit(split, 30000)).toBe(split)
    const scaled = scaleSplit(split, 10000)
    expect(scaled.map((s) => s.amount)).toEqual([3333, 6667])
    expect(scaled.reduce((a, s) => a + s.amount, 0)).toBe(10000)
  })

  it('회계 배분은 사업에 연결된 몫만, 같은 사업은 합친다', () => {
    const split = [
      { key: 'edu', label: '아동 교육', amount: 10000, programId: P1 },
      { key: 'free', label: '어디든', amount: 10000, programId: null },
      { key: 'edu2', label: '교육 2', amount: 10000, programId: P1 },
    ]
    expect(allocateSplit(split, 30000)).toEqual([{ programId: P1, amount: 20000 }])
    expect(allocateSplit([{ key: 'free', label: '어디든', amount: 1000, programId: null }], 1000)).toEqual([])
  })

  it('저장값 읽기', () => {
    expect(readSplit(null)).toEqual([])
    expect(readSplit([{ key: 'a', label: 'A', amount: 1 }, { bad: 1 }])).toEqual([{ key: 'a', label: 'A', amount: 1, programId: null }])
  })
})
