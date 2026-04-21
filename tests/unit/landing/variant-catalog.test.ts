import { describe, it, expect } from 'vitest'
import '@/lib/landing-variants/register-all'
import { getVariants, findVariant } from '@/lib/landing-variants'
import type { LandingSectionType } from '@/types/landing'

const ALL_TYPES: LandingSectionType[] = [
  'hero', 'stats', 'impact', 'campaigns', 'donation-tiers', 'team', 'cta', 'richtext',
  'testimonials', 'logos', 'faq', 'timeline', 'gallery', 'financials',
]

const EXPECTED_COUNTS: Record<LandingSectionType, number> = {
  hero: 6, stats: 5, impact: 5, campaigns: 5, 'donation-tiers': 5, team: 5, cta: 5,
  richtext: 3, testimonials: 5, logos: 4, faq: 4, timeline: 4, gallery: 5,
  financials: 4,
}

describe('VARIANT_CATALOG (Phase A~D 전체)', () => {
  it('14개 섹션 타입 모두 variant 등록', () => {
    for (const t of ALL_TYPES) {
      expect(getVariants(t).length).toBeGreaterThan(0)
    }
  })

  it('섹션별 variant 수 일치 (총 65개)', () => {
    let total = 0
    for (const t of ALL_TYPES) {
      const count = getVariants(t).length
      expect(count, `${t} variant count`).toBe(EXPECTED_COUNTS[t])
      total += count
    }
    const sum = Object.values(EXPECTED_COUNTS).reduce((a, b) => a + b, 0)
    expect(total).toBe(sum)
  })

  it('각 variant의 defaultData가 자체 schema를 통과한다', () => {
    for (const t of ALL_TYPES) {
      for (const v of getVariants(t)) {
        const r = v.dataSchema.safeParse(v.defaultData())
        expect(r.success, `${v.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true)
      }
    }
  })

  it('findVariant id 역조회', () => {
    expect(findVariant('hero-fullscreen-image')?.type).toBe('hero')
    expect(findVariant('testimonials-wall')?.type).toBe('testimonials')
    expect(findVariant('gallery-fullbleed')?.type).toBe('gallery')
    expect(findVariant('tiers-pricing-table')?.type).toBe('donation-tiers')
    expect(findVariant('team-org-chart')?.type).toBe('team')
    expect(findVariant('not-exist')).toBeUndefined()
  })

  it('variant id는 {type}-xxx 패턴 (donation-tiers는 tiers-xxx 예외)', () => {
    for (const t of ALL_TYPES) {
      const prefix = t === 'donation-tiers' ? 'tiers-' : `${t}-`
      for (const v of getVariants(t)) {
        expect(v.id.startsWith(prefix), `${v.id} prefix`).toBe(true)
      }
    }
  })

  it('preview 경로는 /landing-variants/{id}.svg', () => {
    for (const t of ALL_TYPES) {
      for (const v of getVariants(t)) {
        expect(v.preview).toBe(`/landing-variants/${v.id}.svg`)
      }
    }
  })

  it('visualWeight 값이 유효 (minimal/bold/cinematic)', () => {
    for (const t of ALL_TYPES) {
      for (const v of getVariants(t)) {
        expect(['minimal', 'bold', 'cinematic']).toContain(v.visualWeight)
      }
    }
  })
})
