import type { CampaignsBaseData } from '@/lib/landing-variants/campaigns-schemas'
import { CampaignCard, type CampaignRow } from './CampaignCard'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CampaignsMasonry({ data, campaigns }: { data: CampaignsBaseData; campaigns: CampaignRow[] }) {
  const { title = '진행 중인 캠페인', subtitle, showProgress = true, maxCount = 6 } = data
  const visible = campaigns.slice(0, maxCount)

  return (
    <section id="campaigns" className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}

        {visible.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">진행 중인 캠페인이 없습니다.</p>
        ) : (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-5 space-y-5">
            {visible.map((c, i) => (
              <MotionFadeUp key={c.id} delay={i * 0.05} className="break-inside-avoid">
                <CampaignCard campaign={c} showProgress={showProgress} />
              </MotionFadeUp>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
