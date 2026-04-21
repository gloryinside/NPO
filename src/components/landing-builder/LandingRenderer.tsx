import type { LandingSection, LandingSectionData, CampaignsSectionData } from '@/types/landing'
import { HeroSection } from './sections/HeroSection'
import { StatsSection } from './sections/StatsSection'
import { ImpactSection } from './sections/ImpactSection'
import { CampaignsSection } from './sections/CampaignsSection'
import { DonationTiersSection } from './sections/DonationTiersSection'
import { TeamSection } from './sections/TeamSection'
import { CtaSection } from './sections/CtaSection'
import { RichtextSection } from './sections/RichtextSection'

interface CampaignRow {
  id: string
  title: string
  slug: string
  description: string | null
  goal_amount: number | null
  ended_at: string | null
  thumbnail_url: string | null
  raised: number
}

interface Props {
  sections: LandingSection[]
  campaigns?: CampaignRow[]
}

function renderSection(section: LandingSection, campaigns: CampaignRow[]) {
  const d = section.data as LandingSectionData & Record<string, unknown>

  switch (section.type) {
    case 'hero':
      return <HeroSection key={section.id} data={d as Parameters<typeof HeroSection>[0]['data']} />
    case 'stats':
      return <StatsSection key={section.id} data={d as Parameters<typeof StatsSection>[0]['data']} />
    case 'impact':
      return <ImpactSection key={section.id} data={d as Parameters<typeof ImpactSection>[0]['data']} />
    case 'campaigns':
      return (
        <CampaignsSection
          key={section.id}
          data={d as CampaignsSectionData}
          campaigns={campaigns}
        />
      )
    case 'donation-tiers':
      return <DonationTiersSection key={section.id} data={d as Parameters<typeof DonationTiersSection>[0]['data']} />
    case 'team':
      return <TeamSection key={section.id} data={d as Parameters<typeof TeamSection>[0]['data']} />
    case 'cta':
      return <CtaSection key={section.id} data={d as Parameters<typeof CtaSection>[0]['data']} />
    case 'richtext':
      return <RichtextSection key={section.id} data={d as Parameters<typeof RichtextSection>[0]['data']} />
    default:
      return null
  }
}

export function LandingRenderer({ sections, campaigns = [] }: Props) {
  const visible = sections
    .filter(s => s.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <>
      {visible.map(section => renderSection(section, campaigns))}
    </>
  )
}
