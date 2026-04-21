import type { TestimonialsCardsData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TestimonialsCards({ data }: { data: TestimonialsCardsData }) {
  const { title, items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          {items.map((t, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <div className="p-6 border border-[var(--border)] bg-[var(--bg)] h-full flex flex-col gap-4"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                <p className="text-sm leading-relaxed text-[var(--text)] flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3">
                  {t.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={t.photoUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-sm font-bold text-[var(--accent)]">
                      {t.name[0]}
                    </div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-[var(--text)]">{t.name}</div>
                    {t.role && <div className="text-xs text-[var(--muted-foreground)]">{t.role}</div>}
                  </div>
                </div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
