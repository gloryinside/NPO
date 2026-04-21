import type { LandingSection } from '@/types/landing'
import { VARIANT_COMPONENTS } from './variant-components'

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
  const Component = VARIANT_COMPONENTS[section.variant]
  if (!Component) {
    return (
      <section key={section.id} className="border-b border-[var(--border)] bg-[var(--surface-2)] py-12 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          알 수 없는 섹션 variant: <code>{section.variant}</code>
        </p>
      </section>
    )
  }
  if (section.type === 'campaigns') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <Component key={section.id} data={section.data as never} campaigns={campaigns as any} />
  }
  return <Component key={section.id} data={section.data as never} />
}

export function LandingRenderer({ sections, campaigns = [] }: Props) {
  const visible = [...sections]
    .filter((s) => s.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return <>{visible.map((section) => renderSection(section, campaigns))}</>
}
