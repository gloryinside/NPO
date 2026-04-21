import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { CampaignsSectionData } from '@/types/landing'

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
  data: CampaignsSectionData
  campaigns: CampaignRow[]
}

function formatKRW(n: number) {
  return new Intl.NumberFormat('ko-KR').format(n) + '원'
}

export function CampaignsSection({ data, campaigns }: Props) {
  const { title = '진행 중인 캠페인', subtitle, showProgress = true, maxCount = 3 } = data
  const visible = campaigns.slice(0, maxCount)

  return (
    <section id="campaigns" className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
        {subtitle && (
          <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>
        )}
        {!subtitle && <div className="mb-10" />}

        {visible.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">
            진행 중인 캠페인이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visible.map((campaign) => {
              const pct = campaign.goal_amount && campaign.goal_amount > 0
                ? Math.min(Math.round((campaign.raised / campaign.goal_amount) * 100), 100)
                : null

              return (
                <Link key={campaign.id} href={`/campaigns/${campaign.slug}`} className="block group no-underline">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full flex flex-col transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg">
                    {campaign.thumbnail_url ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={campaign.thumbnail_url} alt={campaign.title} className="w-full h-40 object-cover" />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)]" />
                    )}
                    <div className="p-5 flex-1 flex flex-col">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-base font-semibold leading-snug text-[var(--text)]">{campaign.title}</h3>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {campaign.ended_at && (() => {
                            const d = Math.ceil((new Date(campaign.ended_at).getTime() - Date.now()) / 86400000)
                            return d >= 0 ? (
                              <span className="text-xs font-semibold rounded-full px-2 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)]">D-{d}</span>
                            ) : null
                          })()}
                          <Badge className="border-0 text-xs bg-green-500/10 text-green-500">진행 중</Badge>
                        </div>
                      </div>
                      {campaign.description && (
                        <p className="text-sm line-clamp-2 mb-3 flex-1 text-[var(--muted-foreground)]">{campaign.description}</p>
                      )}
                      {showProgress && pct !== null && (
                        <div className="mt-auto mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--muted-foreground)]">{formatKRW(campaign.raised)}</span>
                            <span className="text-[var(--muted-foreground)]">{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden bg-[var(--surface-2)]">
                            <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="text-xs mt-1 text-right text-[var(--muted-foreground)]">
                            목표 {formatKRW(campaign.goal_amount ?? 0)}
                          </div>
                        </div>
                      )}
                      <span className="text-sm font-semibold mt-auto text-[var(--accent)]">후원하기 →</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
