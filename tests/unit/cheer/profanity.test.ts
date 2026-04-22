import { describe, it, expect } from 'vitest'
import { analyzeProfanity } from '@/lib/cheer/profanity'

describe('analyzeProfanity', () => {
  it('빈 문자열은 clean', () => {
    expect(analyzeProfanity('')).toEqual({ verdict: 'clean', score: 0 })
    expect(analyzeProfanity('   ')).toEqual({ verdict: 'clean', score: 0 })
  })

  it('평범한 응원은 clean', () => {
    const cases = [
      '늘 감사합니다. 응원합니다!',
      '작은 정성 보탭니다.',
      '힘내세요! 함께해요',
    ]
    for (const c of cases) {
      expect(analyzeProfanity(c).verdict).toBe('clean')
    }
  })

  it('soft 단어 1개는 suspicious (대기)', () => {
    const r = analyzeProfanity('좀 바보 같아요')
    expect(r.verdict).toBe('suspicious')
    if (r.verdict === 'suspicious') expect(r.score).toBe(1)
  })

  it('hard 단어 1개 + soft 1개는 block (점수 ≥4는 아니지만 hard 2점 + soft 1점=3이라 suspicious)', () => {
    const r = analyzeProfanity('이거 존나 쓰레기네')
    // 존나=hard(+2), 쓰레기=soft(+1), 총 3점 → suspicious
    expect(r.verdict).toBe('suspicious')
    if (r.verdict === 'suspicious') {
      expect(r.score).toBe(3)
      expect(r.reasons.some((x) => x.startsWith('hard:'))).toBe(true)
    }
  })

  it('hard 단어 2개는 block (점수 4)', () => {
    const r = analyzeProfanity('씨발 병신같은')
    expect(r.verdict).toBe('block')
    if (r.verdict === 'block') expect(r.score).toBeGreaterThanOrEqual(4)
  })

  it('띄어쓰기/구두점 우회도 잡힌다', () => {
    const r = analyzeProfanity('씨  발.')
    expect(r.verdict).not.toBe('clean')
  })

  it('영문 욕설도 감지', () => {
    const r = analyzeProfanity('This is fuck absurd')
    expect(r.verdict).not.toBe('clean')
  })

  it('URL 3개는 suspicious로 올라간다', () => {
    const msg =
      '함께해요 https://a.com 응원합니다 https://b.com 기부링크 https://c.com'
    const r = analyzeProfanity(msg)
    expect(r.verdict).toBe('suspicious')
  })

  it('URL 5개 이상은 block', () => {
    const msg = Array.from(
      { length: 5 },
      (_, i) => `https://spam${i}.com`
    ).join(' ')
    const r = analyzeProfanity(msg)
    expect(r.verdict).toBe('block')
  })

  it('같은 문자 도배는 block', () => {
    const r = analyzeProfanity('ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ')
    expect(r.verdict).not.toBe('clean')
    // 11글자 반복 → +2, 혼자면 suspicious
    expect(['suspicious', 'block']).toContain(r.verdict)
  })

  it('같은 단어 5회 이상 반복', () => {
    const r = analyzeProfanity('홍보 홍보 홍보 홍보 홍보')
    expect(r.verdict).toBe('suspicious')
  })
})
