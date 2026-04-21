import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TimelineMilestones({ data }: { data: TimelineBaseData }) {
  const { title, events } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-14 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-8" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {events.map((e, i) => (
            <MotionFadeUp key={i} delay={i * 0.1}>
              <article className="overflow-hidden bg-[var(--surface)] border border-[var(--border)] h-full flex flex-col"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                {e.imageUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={e.imageUrl} alt={e.title} className="w-full h-40 object-cover" />
                ) : (
                  <div className="w-full h-40 flex items-center justify-center text-display text-[var(--accent)]">
                    {e.year}
                  </div>
                )}
                <div className="p-5">
                  <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-1">{e.year}</div>
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2">{e.title}</h3>
                  {e.body && <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">{e.body}</p>}
                </div>
              </article>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
