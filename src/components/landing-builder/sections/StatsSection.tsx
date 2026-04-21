import type { StatsSectionData } from '@/types/landing'

interface Props {
  data: StatsSectionData
}

export function StatsSection({ data }: Props) {
  const { title, items } = data

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14 text-center">
        {title && (
          <h2 className="text-2xl font-bold mb-10 text-[var(--text)]">{title}</h2>
        )}
        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}
        >
          {items.map((item, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              {item.icon && <span className="text-3xl">{item.icon}</span>}
              <div className="text-3xl font-bold text-[var(--accent)]">{item.value}</div>
              <div className="text-sm text-[var(--muted-foreground)]">{item.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
