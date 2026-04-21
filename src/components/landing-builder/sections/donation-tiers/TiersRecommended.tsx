import type { TiersRecommendedData } from '@/lib/landing-variants/tiers-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

export function TiersRecommended({ data }: { data: TiersRecommendedData }) {
  const { title = '추천 후원 등급', subtitle, tiers, recommendedIndex = 1 } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm mb-12 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-12" />}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, i) => {
            const recommended = i === recommendedIndex
            return (
              <MotionFadeUp key={i} delay={i * 0.1}>
                <div className={`relative border p-7 flex flex-col items-center gap-3 transition-transform h-full ${recommended ? 'md:scale-105 md:z-10' : 'md:scale-95'}`}
                  style={{
                    borderRadius: 'var(--radius-card)',
                    borderColor: recommended ? 'var(--accent)' : 'var(--border)',
                    background: recommended ? 'var(--surface)' : 'var(--surface-2)',
                    boxShadow: recommended ? 'var(--shadow-hero)' : 'var(--shadow-card)',
                  }}>
                  {recommended && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--accent)] text-white text-xs font-bold">
                      ⭐ 추천
                    </div>
                  )}
                  {tier.icon && <span className="text-5xl">{tier.icon}</span>}
                  <div className="text-3xl font-bold text-[var(--accent)]">{formatKRW(tier.amount)}</div>
                  <div className="text-lg font-semibold text-[var(--text)]">{tier.label}</div>
                  {tier.description && <p className="text-sm text-[var(--muted-foreground)] whitespace-pre-line">{tier.description}</p>}
                </div>
              </MotionFadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
