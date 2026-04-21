import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TimelineAlternating({ data }: { data: TimelineBaseData }) {
  const { title, events } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-14 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="relative">
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-[var(--accent)]/30" aria-hidden />
          <div className="space-y-12">
            {events.map((e, i) => {
              const right = i % 2 === 1
              return (
                <MotionFadeUp key={i} delay={i * 0.08}>
                  <div className="relative flex items-center">
                    <div className={`w-1/2 ${right ? 'pr-10 text-right' : 'pl-10 order-2'}`} />
                    <div className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[var(--accent)] border-4 border-[var(--surface)] z-10" aria-hidden />
                    <div className={`w-1/2 ${right ? 'pl-10 order-3' : 'pr-10 text-right order-1'}`}>
                      <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-1">{e.year}</div>
                      <h3 className="text-lg font-semibold text-[var(--text)] mb-2">{e.title}</h3>
                      {e.body && <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{e.body}</p>}
                    </div>
                  </div>
                </MotionFadeUp>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
