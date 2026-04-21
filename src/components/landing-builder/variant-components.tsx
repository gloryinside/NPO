import type { ComponentType } from 'react'

// Phase A: hero
import { HeroMinimal } from './sections/hero/HeroMinimal'
import { HeroSplitImage } from './sections/hero/HeroSplitImage'
import { HeroFullscreenImage } from './sections/hero/HeroFullscreenImage'
import { HeroFullscreenVideo } from './sections/hero/HeroFullscreenVideo'
import { HeroGallery } from './sections/hero/HeroGallery'
import { HeroStatsOverlay } from './sections/hero/HeroStatsOverlay'

// Phase A: cta
import { CtaBanner } from './sections/cta/CtaBanner'
import { CtaGradient } from './sections/cta/CtaGradient'
import { CtaSplit } from './sections/cta/CtaSplit'
import { CtaUrgency } from './sections/cta/CtaUrgency'
import { CtaFullscreen } from './sections/cta/CtaFullscreen'

// Phase A: stats
import { StatsGrid } from './sections/stats/StatsGrid'
import { StatsInline } from './sections/stats/StatsInline'
import { StatsCards } from './sections/stats/StatsCards'
import { StatsCountup } from './sections/stats/StatsCountup'
import { StatsBig } from './sections/stats/StatsBig'

// Phase B: testimonials
import { TestimonialsCards } from './sections/testimonials/TestimonialsCards'
import { TestimonialsCarousel } from './sections/testimonials/TestimonialsCarousel'
import { TestimonialsWall } from './sections/testimonials/TestimonialsWall'
import { TestimonialsQuoteLarge } from './sections/testimonials/TestimonialsQuoteLarge'
import { TestimonialsVideo } from './sections/testimonials/TestimonialsVideo'

// Phase B: logos
import { LogosGrid } from './sections/logos/LogosGrid'
import { LogosMarquee } from './sections/logos/LogosMarquee'
import { LogosPress } from './sections/logos/LogosPress'
import { LogosPartners } from './sections/logos/LogosPartners'

// Phase B: faq
import { FaqAccordion } from './sections/faq/FaqAccordion'
import { FaqTwoColumn } from './sections/faq/FaqTwoColumn'
import { FaqCategorized } from './sections/faq/FaqCategorized'
import { FaqSearch } from './sections/faq/FaqSearch'

// Phase C: impact
import { ImpactAlternating } from './sections/impact/ImpactAlternating'
import { ImpactZigzag } from './sections/impact/ImpactZigzag'
import { ImpactCards } from './sections/impact/ImpactCards'
import { ImpactStorytelling } from './sections/impact/ImpactStorytelling'
import { ImpactBeforeAfter } from './sections/impact/ImpactBeforeAfter'

// Phase C: timeline
import { TimelineVertical } from './sections/timeline/TimelineVertical'
import { TimelineAlternating } from './sections/timeline/TimelineAlternating'
import { TimelineHorizontal } from './sections/timeline/TimelineHorizontal'
import { TimelineMilestones } from './sections/timeline/TimelineMilestones'

// Phase C: gallery
import { GalleryGrid } from './sections/gallery/GalleryGrid'
import { GalleryMasonry } from './sections/gallery/GalleryMasonry'
import { GalleryLightbox } from './sections/gallery/GalleryLightbox'
import { GalleryCarousel } from './sections/gallery/GalleryCarousel'
import { GalleryFullbleed } from './sections/gallery/GalleryFullbleed'

// Phase D: campaigns (기존 CampaignsSection을 campaigns-grid default로 유지)
import { CampaignsSection } from './sections/CampaignsSection'
import { CampaignsFeatured } from './sections/campaigns/CampaignsFeatured'
import { CampaignsCarousel } from './sections/campaigns/CampaignsCarousel'
import { CampaignsList } from './sections/campaigns/CampaignsList'
import { CampaignsMasonry } from './sections/campaigns/CampaignsMasonry'

// Phase D: donation-tiers
import { TiersCards } from './sections/donation-tiers/TiersCards'
import { TiersComparison } from './sections/donation-tiers/TiersComparison'
import { TiersRecommended } from './sections/donation-tiers/TiersRecommended'
import { TiersHorizontal } from './sections/donation-tiers/TiersHorizontal'
import { TiersPricingTable } from './sections/donation-tiers/TiersPricingTable'

// Phase D: team
import { TeamGrid } from './sections/team/TeamGrid'
import { TeamCards } from './sections/team/TeamCards'
import { TeamFeatured } from './sections/team/TeamFeatured'
import { TeamCarousel } from './sections/team/TeamCarousel'
import { TeamOrgChart } from './sections/team/TeamOrgChart'

// Phase D: richtext
import { RichtextPlain } from './sections/richtext/RichtextPlain'
import { RichtextBoxed } from './sections/richtext/RichtextBoxed'
import { RichtextQuote } from './sections/richtext/RichtextQuote'

// G-61 안전망: v1 동작을 보존한 legacy 컴포넌트 별칭.
// 스테이징에서 회귀 발견 시 DB의 section.variant를 'legacy-*'로 변경해 즉시 복원 가능.
import { ImpactSection } from './sections/ImpactSection'
import { DonationTiersSection } from './sections/DonationTiersSection'
import { TeamSection } from './sections/TeamSection'
import { RichtextSection } from './sections/RichtextSection'

/**
 * variant id → React component. 각 컴포넌트는 자기만의 data 타입을 가지므로
 * 타입 안전성을 위해 LandingRenderer는 unknown 래퍼로 호출한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const VARIANT_COMPONENTS: Record<string, ComponentType<any>> = {
  // hero
  'hero-minimal': HeroMinimal,
  'hero-split-image': HeroSplitImage,
  'hero-fullscreen-image': HeroFullscreenImage,
  'hero-fullscreen-video': HeroFullscreenVideo,
  'hero-gallery': HeroGallery,
  'hero-stats-overlay': HeroStatsOverlay,
  // cta
  'cta-banner': CtaBanner,
  'cta-gradient': CtaGradient,
  'cta-split': CtaSplit,
  'cta-urgency': CtaUrgency,
  'cta-fullscreen': CtaFullscreen,
  // stats
  'stats-grid': StatsGrid,
  'stats-inline': StatsInline,
  'stats-cards': StatsCards,
  'stats-countup': StatsCountup,
  'stats-big': StatsBig,
  // testimonials (Phase B)
  'testimonials-cards': TestimonialsCards,
  'testimonials-carousel': TestimonialsCarousel,
  'testimonials-wall': TestimonialsWall,
  'testimonials-quote-large': TestimonialsQuoteLarge,
  'testimonials-video': TestimonialsVideo,
  // logos (Phase B)
  'logos-grid': LogosGrid,
  'logos-marquee': LogosMarquee,
  'logos-press': LogosPress,
  'logos-partners': LogosPartners,
  // faq (Phase B)
  'faq-accordion': FaqAccordion,
  'faq-two-column': FaqTwoColumn,
  'faq-categorized': FaqCategorized,
  'faq-search': FaqSearch,
  // impact (Phase C — 신규 variant가 기존 ImpactSection을 대체)
  'impact-alternating': ImpactAlternating,
  'impact-zigzag': ImpactZigzag,
  'impact-cards': ImpactCards,
  'impact-storytelling': ImpactStorytelling,
  'impact-before-after': ImpactBeforeAfter,
  // timeline (Phase C)
  'timeline-vertical': TimelineVertical,
  'timeline-alternating': TimelineAlternating,
  'timeline-horizontal': TimelineHorizontal,
  'timeline-milestones': TimelineMilestones,
  // gallery (Phase C)
  'gallery-grid': GalleryGrid,
  'gallery-masonry': GalleryMasonry,
  'gallery-lightbox': GalleryLightbox,
  'gallery-carousel': GalleryCarousel,
  'gallery-fullbleed': GalleryFullbleed,
  // campaigns (Phase D)
  'campaigns-grid': CampaignsSection,
  'campaigns-featured': CampaignsFeatured,
  'campaigns-carousel': CampaignsCarousel,
  'campaigns-list': CampaignsList,
  'campaigns-masonry': CampaignsMasonry,
  // donation-tiers (Phase D)
  'tiers-cards': TiersCards,
  'tiers-comparison': TiersComparison,
  'tiers-recommended': TiersRecommended,
  'tiers-horizontal': TiersHorizontal,
  'tiers-pricing-table': TiersPricingTable,
  // team (Phase D)
  'team-grid': TeamGrid,
  'team-cards': TeamCards,
  'team-featured': TeamFeatured,
  'team-carousel': TeamCarousel,
  'team-org-chart': TeamOrgChart,
  // richtext (Phase D)
  'richtext-plain': RichtextPlain,
  'richtext-boxed': RichtextBoxed,
  'richtext-quote': RichtextQuote,
  // G-61 legacy 별칭 — 스테이징 회귀 발견 시 수동 전환 통로
  'legacy-impact': ImpactSection,
  'legacy-tiers': DonationTiersSection,
  'legacy-team': TeamSection,
  'legacy-richtext': RichtextSection,
}
