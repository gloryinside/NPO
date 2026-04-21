import type { RichtextQuoteData } from '@/lib/landing-variants/richtext-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function RichtextQuote({ data }: { data: RichtextQuoteData }) {
  const { title, content, author } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-3xl mx-auto px-6 py-20 text-center">
        {title && <MotionFadeUp><div className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-4">{title}</div></MotionFadeUp>}
        <MotionFadeUp>
          <span className="text-6xl text-[var(--accent)] leading-none block mb-4" aria-hidden>&ldquo;</span>
        </MotionFadeUp>
        <MotionFadeUp delay={0.1}>
          <blockquote className="text-hero text-[var(--text)] italic leading-tight">
            {content}
          </blockquote>
        </MotionFadeUp>
        {author && (
          <MotionFadeUp delay={0.2}>
            <cite className="block mt-6 text-sm text-[var(--muted-foreground)] not-italic">— {author}</cite>
          </MotionFadeUp>
        )}
      </div>
    </section>
  )
}
