import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TimelineHorizontal({ data }: { data: TimelineBaseData }) {
  const { title, events } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="overflow-x-auto pb-4">
          <div className="relative inline-flex gap-0 pt-4 pb-12 min-w-full">
            <div className="absolute top-6 left-0 right-0 h-0.5 bg-[var(--accent)]/30" aria-hidden />
            {events.map((e, i) => (
              <div key={i} className="relative flex-shrink-0 w-64 px-4">
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[var(--accent)] border-4 border-[var(--bg)] z-10" aria-hidden />
                <div className="mt-14 text-center">
                  <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">{e.year}</div>
                  <h3 className="text-sm font-semibold text-[var(--text)] mb-2">{e.title}</h3>
                  {e.body && <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{e.body}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
