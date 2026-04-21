import type { HeroStatsOverlayData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'
import { CountUp } from '../../shared/CountUp'

export function HeroStatsOverlay({ data }: { data: HeroStatsOverlayData }) {
  const { bgImageUrl, overlayOpacity, kenBurns = true, headline, subheadline, ctaText, ctaUrl, stats } = data

  return (
    <section className="relative overflow-hidden min-h-[90vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} enabled={kenBurns} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-44 min-h-[90vh] flex flex-col justify-center text-center items-center">
        <MotionFadeUp>
          <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
        </MotionFadeUp>
        {subheadline && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
          </MotionFadeUp>
        )}
        {ctaText && (
          <MotionFadeUp delay={0.2}>
            <a href={ctaUrl || '#'}
              className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: 'var(--shadow-hero)' }}>
              {ctaText} →
            </a>
          </MotionFadeUp>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-md border-t border-white/20">
        <div className="max-w-5xl mx-auto px-6 py-6 grid gap-6"
          style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}>
          {stats.map((s, i) => (
            <div key={i} className="text-center text-white">
              <div className="text-3xl font-bold mb-1"><CountUp value={s.value} /></div>
              <div className="text-xs uppercase tracking-wider text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
