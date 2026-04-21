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

// Legacy (Phase B~D에서 각 섹션별 variant 추가 예정)
import { ImpactSection } from './sections/ImpactSection'
import { CampaignsSection } from './sections/CampaignsSection'
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
  // legacy default variants
  'impact-alternating': ImpactSection,
  'campaigns-grid': CampaignsSection,
  'tiers-cards': DonationTiersSection,
  'team-grid': TeamSection,
  'richtext-plain': RichtextSection,
}
