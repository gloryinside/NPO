import type { StatsInlineData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsInline({ data }: { data: StatsInlineData }) {
  const { items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-wrap justify-around items-center gap-4 divide-x divide-[var(--border)]">
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.05} className="flex items-center gap-3 px-4">
              {it.icon && <span className="text-xl">{it.icon}</span>}
              <span className="text-xl font-bold text-[var(--accent)]">{it.value}</span>
              <span className="text-sm text-[var(--muted-foreground)]">{it.label}</span>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
