import type { CtaGradientData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaGradient({ data }: { data: CtaGradientData }) {
  const { gradientFrom, gradientTo, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="border-b border-[var(--border)]"
      style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <MotionFadeUp>
          <h2 className="text-hero text-white mb-4 drop-shadow">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mx-auto mb-10 text-white/90">{body}</p>
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
