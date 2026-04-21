import type { StatsGridData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsGrid({ data }: { data: StatsGridData }) {
  const { title, items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <div className="flex flex-col items-center gap-2">
                {it.icon && <span className="text-3xl">{it.icon}</span>}
                <div className="text-3xl font-bold text-[var(--accent)]">{it.value}</div>
                <div className="text-sm text-[var(--muted-foreground)]">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
