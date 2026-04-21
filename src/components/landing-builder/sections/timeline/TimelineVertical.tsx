import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TimelineVertical({ data }: { data: TimelineBaseData }) {
  const { title, events } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <ol className="relative border-l-2 border-[var(--accent)]/30 ml-4 space-y-10">
          {events.map((e, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <li className="ml-6 pl-2">
                <div className="absolute -left-[11px] w-5 h-5 rounded-full bg-[var(--accent)] border-4 border-[var(--bg)]" aria-hidden />
                <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-1">{e.year}</div>
                <h3 className="text-lg font-semibold text-[var(--text)] mb-2">{e.title}</h3>
                {e.body && <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{e.body}</p>}
              </li>
            </MotionFadeUp>
          ))}
        </ol>
      </div>
    </section>
  )
}
