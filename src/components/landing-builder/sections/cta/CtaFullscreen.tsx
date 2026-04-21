import type { CtaFullscreenData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'

export function CtaFullscreen({ data }: { data: CtaFullscreenData }) {
  const { bgImageUrl, overlayOpacity, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <MotionFadeUp>
          <h2 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mb-10 text-white/90">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-full px-12 py-4 text-lg font-bold text-[var(--accent)] bg-white hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: 'var(--shadow-hero)' }}>
            {buttonText} →
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
