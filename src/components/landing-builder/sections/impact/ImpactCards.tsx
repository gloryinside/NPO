import type { ImpactCardsData } from '@/lib/landing-variants/impact-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function ImpactCards({ data }: { data: ImpactCardsData }) {
  const { title, blocks } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {blocks.map((block, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <div className="bg-[var(--bg)] border border-[var(--border)] overflow-hidden h-full flex flex-col hover:-translate-y-1 transition-transform"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                {block.imageUrl && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={block.imageUrl} alt={block.headline} className="w-full h-48 object-cover" />
                )}
                <div className="p-5 flex-1">
                  <h3 className="text-lg font-semibold text-[var(--text)] mb-2">{block.headline}</h3>
                  <p className="text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">{block.body}</p>
                </div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
