import { describe, it, expect } from 'vitest'
import '@/lib/landing-variants/register-all'  // side-effect: register all
import { getVariants, findVariant } from '@/lib/landing-variants'

const PHASE_A_TYPES = ['hero', 'cta', 'stats'] as const

describe('VARIANT_CATALOG Phase A', () => {
  it('hero/cta/stats 모두 1개 이상 variant 등록', () => {
    for (const t of PHASE_A_TYPES) {
      expect(getVariants(t).length).toBeGreaterThan(0)
    }
  })

  it('hero 6 / cta 5 / stats 5 개수 일치', () => {
    expect(getVariants('hero').length).toBe(6)
    expect(getVariants('cta').length).toBe(5)
    expect(getVariants('stats').length).toBe(5)
  })

  it('각 variant의 defaultData가 자체 schema를 통과한다', () => {
    for (const t of PHASE_A_TYPES) {
      for (const v of getVariants(t)) {
        const r = v.dataSchema.safeParse(v.defaultData())
        expect(r.success, `${v.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true)
      }
    }
  })

  it('findVariant로 id 역조회 가능', () => {
    expect(findVariant('hero-fullscreen-image')?.type).toBe('hero')
    expect(findVariant('cta-urgency')?.type).toBe('cta')
    expect(findVariant('stats-big')?.type).toBe('stats')
    expect(findVariant('nope-xxx')).toBeUndefined()
  })

  it('각 variant의 preview 경로는 /landing-variants/{id}.svg 형식', () => {
    for (const t of PHASE_A_TYPES) {
      for (const v of getVariants(t)) {
        expect(v.preview).toBe(`/landing-variants/${v.id}.svg`)
      }
    }
  })
})
