import type { TiersPricingTableData } from '@/lib/landing-variants/tiers-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function TiersPricingTable({ data }: { data: TiersPricingTableData }) {
  const { title = '후원 플랜', subtitle, tiers, recommendedIndex = 1 } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <MotionFadeUp>
          <h2 className="text-hero text-center text-[var(--text)] mb-2">{title}</h2>
          {subtitle && <p className="text-base text-center mb-14 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-14" />}
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${Math.min(tiers.length, 4)}, minmax(0, 1fr))` }}>
          {tiers.map((tier, i) => {
            const recommended = i === recommendedIndex
            return (
              <MotionFadeUp key={i} delay={i * 0.08}>
                <div className={`relative flex flex-col border p-8 h-full transition-transform hover:-translate-y-2`}
                  style={{
                    borderRadius: 'var(--radius-hero)',
                    borderColor: recommended ? 'var(--accent)' : 'var(--border)',
                    borderWidth: recommended ? '2px' : '1px',
                    background: recommended ? 'var(--bg)' : 'var(--bg)',
                    boxShadow: recommended ? 'var(--shadow-hero)' : 'var(--shadow-card)',
                  }}>
                  {recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-[var(--accent)] text-white text-xs font-bold whitespace-nowrap">
                      가장 인기
                    </div>
                  )}
                  <div className="text-center mb-6">
                    {tier.icon && <div className="text-4xl mb-2">{tier.icon}</div>}
                    <div className="text-lg font-semibold text-[var(--text)]">{tier.label}</div>
                    <div className="text-4xl font-bold text-[var(--accent)] mt-2">{formatKRW(tier.amount)}</div>
                    <div className="text-xs text-[var(--muted-foreground)] mt-1">월 정기 기준</div>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)] text-center mb-5 whitespace-pre-line">{tier.description}</p>
                  {tier.benefits && tier.benefits.length > 0 && (
                    <ul className="space-y-2 mb-6 flex-1">
                      {tier.benefits.map((b, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-[var(--text)]">
                          <span className="text-[var(--positive)] mt-0.5 flex-shrink-0">✓</span>
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <a href={tier.url || '#campaigns'}
                    className="mt-auto inline-flex items-center justify-center rounded-lg px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                    style={{ background: recommended ? 'var(--accent)' : 'var(--surface-2)', color: recommended ? '#fff' : 'var(--text)' }}>
                    이 등급으로 후원하기
                  </a>
                </div>
              </MotionFadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
