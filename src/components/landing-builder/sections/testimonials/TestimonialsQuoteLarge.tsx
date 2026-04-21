import type { TestimonialsQuoteLargeData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TestimonialsQuoteLarge({ data }: { data: TestimonialsQuoteLargeData }) {
  const { title, items } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-20">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-16 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="space-y-24">
          {items.map((t, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <figure className="max-w-3xl mx-auto text-center">
                <span className="text-6xl text-[var(--accent)] leading-none" aria-hidden>&ldquo;</span>
                <blockquote className="text-hero text-[var(--text)] my-6 leading-tight">
                  {t.quote}
                </blockquote>
                <figcaption className="flex items-center justify-center gap-3 mt-8">
                  {t.photoUrl && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={t.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
                  )}
                  <div className="text-left">
                    <div className="text-sm font-semibold text-[var(--text)]">{t.name}</div>
                    {t.role && <div className="text-xs text-[var(--muted-foreground)]">{t.role}</div>}
                  </div>
                </figcaption>
              </figure>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
