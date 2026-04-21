import type { StatsCardsData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsCards({ data }: { data: StatsCardsData }) {
  const { title, items } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <div className="border border-[var(--border)] bg-[var(--surface)] p-6 transition-transform hover:-translate-y-1"
                style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-card)' }}>
                {it.icon && <div className="text-3xl mb-2">{it.icon}</div>}
                <div className="text-3xl font-bold text-[var(--accent)] mb-1">{it.value}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
