import type { TestimonialsWallData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TestimonialsWall({ data }: { data: TestimonialsWallData }) {
  const { title, items } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
          {items.map((t, i) => (
            <MotionFadeUp key={i} delay={i * 0.04} className="break-inside-avoid">
              <div className="p-5 bg-[var(--surface)] border border-[var(--border)]"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                <p className="text-sm leading-relaxed text-[var(--text)] mb-3">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border)]">
                  {t.photoUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={t.photoUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--surface-2)] flex items-center justify-center text-xs font-bold text-[var(--accent)]">
                      {t.name[0]}
                    </div>
                  )}
                  <div>
                    <div className="text-xs font-semibold text-[var(--text)]">{t.name}</div>
                    {t.role && <div className="text-[10px] text-[var(--muted-foreground)]">{t.role}</div>}
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
