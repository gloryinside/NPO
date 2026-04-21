import { describe, it, expect } from 'vitest'
import { migrateToV2 } from '@/lib/landing-migrate'
import type { LandingPageContent } from '@/types/landing'

describe('migrateToV2', () => {
  it('v2 content는 그대로 반환한다', () => {
    const v2: LandingPageContent = {
      schemaVersion: 2,
      sections: [{ id: 'a', type: 'hero', variant: 'hero-minimal', sortOrder: 0, isVisible: true, data: {} as never }],
    }
    expect(migrateToV2(v2)).toBe(v2)
  })

  it('v1 sections는 {type}-default variant로 채워진다', () => {
    const v1 = {
      schemaVersion: 1 as const,
      sections: [
        { id: 'a', type: 'hero', sortOrder: 0, isVisible: true, data: {} as never },
        { id: 'b', type: 'cta', sortOrder: 1, isVisible: true, data: {} as never },
      ],
    } as unknown as LandingPageContent
    const r = migrateToV2(v1)
    expect(r.schemaVersion).toBe(2)
    expect(r.sections[0].variant).toBe('hero-minimal')
    expect(r.sections[1].variant).toBe('cta-banner')
  })

  it('이미 variant가 있으면 보존한다', () => {
    const mixed = {
      schemaVersion: 1 as const,
      sections: [{ id: 'a', type: 'hero', variant: 'hero-fullscreen-video', sortOrder: 0, isVisible: true, data: {} as never }],
    } as LandingPageContent
    expect(migrateToV2(mixed).sections[0].variant).toBe('hero-fullscreen-video')
  })

  it('donation-tiers는 tiers-cards로 매핑된다', () => {
    const v1 = {
      schemaVersion: 1 as const,
      sections: [{ id: 'a', type: 'donation-tiers', sortOrder: 0, isVisible: true, data: {} as never }],
    } as unknown as LandingPageContent
    expect(migrateToV2(v1).sections[0].variant).toBe('tiers-cards')
  })
})
