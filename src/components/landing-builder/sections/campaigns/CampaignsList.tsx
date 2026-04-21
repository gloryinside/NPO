import Link from 'next/link'
import type { CampaignsBaseData } from '@/lib/landing-variants/campaigns-schemas'
import type { CampaignRow } from './CampaignCard'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function CampaignsList({ data, campaigns }: { data: CampaignsBaseData; campaigns: CampaignRow[] }) {
  const { title = '진행 중인 캠페인', subtitle, showProgress = true, maxCount = 3 } = data
  const visible = campaigns.slice(0, maxCount)

  return (
    <section id="campaigns" className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}

        {visible.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">진행 중인 캠페인이 없습니다.</p>
        ) : (
          <div className="space-y-4">
            {visible.map((c, i) => {
              const pct = c.goal_amount && c.goal_amount > 0
                ? Math.min(Math.round((c.raised / c.goal_amount) * 100), 100)
                : null
              return (
                <MotionFadeUp key={c.id} delay={i * 0.06}>
                  <Link href={`/campaigns/${c.slug}`} className="block group no-underline">
                    <div className="grid grid-cols-[auto_1fr] sm:grid-cols-[160px_1fr] gap-4 p-4 border border-[var(--border)] bg-[var(--bg)] hover:-translate-y-0.5 transition-transform"
                      style={{ borderRadius: 'var(--radius-card)' }}>
                      {c.thumbnail_url ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={c.thumbnail_url} alt={c.title} className="w-24 h-24 sm:w-full sm:h-full object-cover"
                          style={{ borderRadius: 'calc(var(--radius-card) - 4px)' }} />
                      ) : (
                        <div className="w-24 h-24 sm:w-full sm:h-full bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)]"
                          style={{ borderRadius: 'calc(var(--radius-card) - 4px)' }} />
                      )}
                      <div className="flex flex-col">
                        <h3 className="text-base font-semibold text-[var(--text)] mb-1">{c.title}</h3>
                        {c.description && <p className="text-xs text-[var(--muted-foreground)] line-clamp-2 mb-3">{c.description}</p>}
                        {showProgress && pct !== null && (
                          <div className="mt-auto">
                            <div className="h-2 rounded-full overflow-hidden bg-[var(--surface-2)] mb-1">
                              <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
                            </div>
                            <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
                              <span>{formatKRW(c.raised)} / 목표 {formatKRW(c.goal_amount ?? 0)}</span>
                              <span className="font-semibold text-[var(--accent)]">{pct}%</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </MotionFadeUp>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
