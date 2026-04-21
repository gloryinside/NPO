import type { LandingPageContent, LandingSectionType } from '@/types/landing'

const DEFAULT_VARIANT: Record<LandingSectionType, string> = {
  hero: 'hero-minimal',
  stats: 'stats-grid',
  impact: 'impact-alternating',
  campaigns: 'campaigns-grid',
  'donation-tiers': 'tiers-cards',
  team: 'team-grid',
  cta: 'cta-banner',
  richtext: 'richtext-plain',
  testimonials: 'testimonials-cards',
  logos: 'logos-grid',
  faq: 'faq-accordion',
  timeline: 'timeline-vertical',
  gallery: 'gallery-grid',
  financials: 'financials-summary',
}

/**
 * v1 page_content(섹션에 variant 필드 없음)를 v2로 lazy 변환.
 * v2는 그대로 반환. 이미 variant가 설정된 섹션은 보존.
 */
export function migrateToV2(content: LandingPageContent): LandingPageContent {
  if (content.schemaVersion === 2) return content
  return {
    schemaVersion: 2,
    sections: content.sections.map((s) => ({
      ...s,
      variant: s.variant ?? DEFAULT_VARIANT[s.type] ?? `${s.type}-default`,
    })),
  }
}
