import type { CtaSplitData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaSplit({ data }: { data: CtaSplitData }) {
  const { bgColor, headline, body, buttonText, buttonUrl, secondaryLabel, secondaryValue } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div>
          <MotionFadeUp>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{headline}</h2>
          </MotionFadeUp>
          {body && (
            <MotionFadeUp delay={0.1}>
              <p className="text-white/80 text-base">{body}</p>
            </MotionFadeUp>
          )}
        </div>
        <MotionFadeUp delay={0.2} className="flex flex-col items-start md:items-end gap-2">
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-card)' }}>
            {buttonText} →
          </a>
          {secondaryLabel && secondaryValue && (
            <div className="text-sm text-white/70">
              {secondaryLabel}: <span className="font-medium text-white">{secondaryValue}</span>
            </div>
          )}
        </MotionFadeUp>
      </div>
    </section>
  )
}
