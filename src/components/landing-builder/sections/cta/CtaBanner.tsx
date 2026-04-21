import type { CtaBannerData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaBanner({ data }: { data: CtaBannerData }) {
  const { bgColor, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <MotionFadeUp>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mx-auto mb-8 text-white/85">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-10 py-3.5 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-card)' }}>
            {buttonText}
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
