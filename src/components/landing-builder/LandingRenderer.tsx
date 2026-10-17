import type { LandingSection } from '@/types/landing'
import { VARIANT_COMPONENTS } from './variant-components'
import { sanitizeSectionUrls } from '@/lib/landing/url-safety'
import { displayAttrs, parseDisplay, shownOn } from '@/lib/landing/display'
import { kstToday } from '@/lib/billing/kst'

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
  /** 보이는 기간 판정 기준 날짜(KST YYYY-MM-DD). 기본 오늘 */
  today?: string
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
  // 저장형 XSS 방어 — javascript: 등 위험 링크·이미지 주소는 렌더 전에 비운다
  const data = sanitizeSectionUrls(section.data)
  // 표시 설정(테마·여백) — 기본값이면 래퍼 없이 그대로(레이아웃 불변)
  const attrs = displayAttrs(parseDisplay((section.data as Record<string, unknown>)?.style))
  const body =
    section.type === 'campaigns' ? (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      <Component data={data as never} campaigns={campaigns as any} />
    ) : (
      <Component data={data as never} />
    )
  if (!attrs.className && !attrs['data-section-theme']) return <div key={section.id} className="contents">{body}</div>
  return (
    <div key={section.id} {...attrs}>
      {body}
    </div>
  )
}

export function LandingRenderer({ sections, campaigns = [], today = kstToday() }: Props) {
  // 숨김·보이는 기간 밖 섹션 제외 — 지난 캠페인 배너가 사람이 끄기 전까지 남던 문제 방지
  const visible = [...sections]
    .filter((s) => shownOn(s, today))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return <>{visible.map((section) => renderSection(section, campaigns))}</>
}
