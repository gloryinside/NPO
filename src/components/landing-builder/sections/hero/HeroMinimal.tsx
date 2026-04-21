import type { HeroMinimalData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function HeroMinimal({ data }: { data: HeroMinimalData }) {
  const { bgColor, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className={`max-w-4xl mx-auto px-6 py-24 flex flex-col ${align}`}>
        <MotionFadeUp>
          <h1 className="text-hero text-[var(--text)] mb-4">{headline}</h1>
        </MotionFadeUp>
        {subheadline && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mb-8 text-[var(--muted-foreground)]">{subheadline}</p>
          </MotionFadeUp>
        )}
        {ctaText && (
          <MotionFadeUp delay={0.2}>
            <a href={ctaUrl || '#'}
              className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
              style={{ boxShadow: 'var(--shadow-card)' }}>
              {ctaText}
            </a>
          </MotionFadeUp>
        )}
      </div>
    </section>
  )
}
