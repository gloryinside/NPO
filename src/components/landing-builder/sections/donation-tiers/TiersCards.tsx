import type { TiersBaseData } from '@/lib/landing-variants/tiers-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function TiersCards({ data }: { data: TiersBaseData }) {
  const { title = '후원 등급 안내', subtitle, tiers } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {tiers.map((tier, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <div className="border border-[var(--border)] bg-[var(--bg)] p-6 flex flex-col items-center gap-3 hover:-translate-y-1 transition-transform h-full"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                {tier.icon && <span className="text-4xl">{tier.icon}</span>}
                <div className="text-2xl font-bold text-[var(--accent)]">{formatKRW(tier.amount)}</div>
                <div className="text-base font-semibold text-[var(--text)]">{tier.label}</div>
                {tier.description && (
                  <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line">{tier.description}</p>
                )}
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
