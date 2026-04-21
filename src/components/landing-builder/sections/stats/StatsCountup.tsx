import type { StatsCountupData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { CountUp } from '../../shared/CountUp'

export function StatsCountup({ data }: { data: StatsCountupData }) {
  const { title, items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <div className="flex flex-col items-center gap-2">
                {it.icon && <span className="text-4xl mb-2">{it.icon}</span>}
                <div className="text-5xl font-bold text-[var(--accent)]"><CountUp value={it.value} /></div>
                <div className="text-sm text-[var(--muted-foreground)] mt-2">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
