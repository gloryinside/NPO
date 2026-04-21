import type { HeroSplitImageData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function HeroSplitImage({ data }: { data: HeroSplitImageData }) {
  const { bgColor, rightImageUrl, imageRatio = '1:1', headline, subheadline, ctaText, ctaUrl } = data
  const aspect = imageRatio === '1:1' ? 'aspect-square' : imageRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-[3/4]'

  return (
    <section className="relative border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
        <div className="order-2 md:order-1">
          <MotionFadeUp>
            <h1 className="text-hero text-[var(--text)] mb-4">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-base mb-8 text-[var(--muted-foreground)]">{subheadline}</p>
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
        <MotionFadeUp delay={0.15} className={`order-1 md:order-2 ${aspect} overflow-hidden`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rightImageUrl} alt="" className="w-full h-full object-cover"
            style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-hero)' }} />
        </MotionFadeUp>
      </div>
    </section>
  )
}
