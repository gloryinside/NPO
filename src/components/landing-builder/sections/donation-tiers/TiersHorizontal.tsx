import type { TiersBaseData } from '@/lib/landing-variants/tiers-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function TiersHorizontal({ data }: { data: TiersBaseData }) {
  const { title = '후원 등급', subtitle, tiers } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-14">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}
        <div className="flex flex-col divide-y divide-[var(--border)] border border-[var(--border)]"
          style={{ borderRadius: 'var(--radius-card)' }}>
          {tiers.map((tier, i) => (
            <MotionFadeUp key={i} delay={i * 0.05}>
              <div className="grid grid-cols-[auto_1fr_auto] gap-4 items-center p-5 hover:bg-[var(--surface)] transition-colors">
                <div className="flex items-center gap-3">
                  {tier.icon && <span className="text-3xl">{tier.icon}</span>}
                  <span className="text-sm font-semibold text-[var(--text)]">{tier.label}</span>
                </div>
                <div className="text-xs text-[var(--muted-foreground)] line-clamp-2">{tier.description}</div>
                <div className="text-xl font-bold text-[var(--accent)]">{formatKRW(tier.amount)}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
