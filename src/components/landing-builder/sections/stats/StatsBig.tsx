import type { StatsBigData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { CountUp } from '../../shared/CountUp'

export function StatsBig({ data }: { data: StatsBigData }) {
  const { title, items, gradient } = data
  const bg = gradient ? 'var(--gradient-soft)' : 'var(--surface)'
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        {title && <MotionFadeUp><h2 className="text-3xl font-bold mb-16 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-12" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.1}>
              <div className="flex flex-col items-center">
                <div className="text-display text-[var(--accent)]"><CountUp value={it.value} /></div>
                <div className="text-base text-[var(--muted-foreground)] mt-4 uppercase tracking-wider">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
