import Link from 'next/link'
import type { CampaignsBaseData } from '@/lib/landing-variants/campaigns-schemas'
import { CampaignCard, type CampaignRow } from './CampaignCard'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { Badge } from '@/components/ui/badge'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function CampaignsFeatured({ data, campaigns }: { data: CampaignsBaseData; campaigns: CampaignRow[] }) {
  const { title = '진행 중인 캠페인', subtitle, showProgress = true, maxCount = 4 } = data
  const visible = campaigns.slice(0, maxCount)
  const [featured, ...rest] = visible

  return (
    <section id="campaigns" className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}

        {!featured ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">진행 중인 캠페인이 없습니다.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            <MotionFadeUp>
              <Link href={`/campaigns/${featured.slug}`} className="block group no-underline">
                <div className="relative border border-[var(--border)] bg-[var(--surface)] overflow-hidden h-full flex flex-col md:h-full hover:-translate-y-1 transition-transform duration-200"
                  style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-hero)' }}>
                  {featured.thumbnail_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={featured.thumbnail_url} alt={featured.title} className="w-full h-80 object-cover" />
                  ) : (
                    <div className="w-full h-80 bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)]" />
                  )}
                  <div className="absolute top-4 left-4">
                    <Badge className="border-0 bg-[var(--accent)] text-white">⭐ 추천 캠페인</Badge>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="text-hero text-[var(--text)] mb-3">{featured.title}</h3>
                    {featured.description && (
                      <p className="text-sm text-[var(--muted-foreground)] mb-4 line-clamp-3 flex-1">{featured.description}</p>
                    )}
                    {showProgress && featured.goal_amount && featured.goal_amount > 0 && (
                      <div className="mb-3">
                        <div className="flex justify-between text-xs mb-1 text-[var(--muted-foreground)]">
                          <span>{formatKRW(featured.raised)}</span>
                          <span>{Math.min(Math.round((featured.raised / featured.goal_amount) * 100), 100)}%</span>
                        </div>
                        <div className="h-2 rounded-full overflow-hidden bg-[var(--surface-2)]">
                          <div className="h-full rounded-full bg-[var(--accent)]"
                            style={{ width: `${Math.min(Math.round((featured.raised / featured.goal_amount) * 100), 100)}%` }} />
                        </div>
                      </div>
                    )}
                    <span className="text-base font-semibold text-[var(--accent)]">지금 후원하기 →</span>
                  </div>
                </div>
              </Link>
            </MotionFadeUp>
            <div className="grid gap-4">
              {rest.map((c, i) => (
                <MotionFadeUp key={c.id} delay={i * 0.1}>
                  <CampaignCard campaign={c} showProgress={showProgress} compact />
                </MotionFadeUp>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
