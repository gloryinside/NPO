import type { HeroFullscreenImageData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'

export function HeroFullscreenImage({ data }: { data: HeroFullscreenImageData }) {
  const { bgImageUrl, overlayOpacity, kenBurns = true, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} enabled={kenBurns} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col justify-center">
        <div className={`flex flex-col ${align}`}>
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
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs animate-bounce" aria-hidden>
        ▼ 스크롤
      </div>
    </section>
  )
}
