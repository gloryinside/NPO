'use client'
import { useState } from 'react'
import type { TestimonialsCarouselData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TestimonialsCarousel({ data }: { data: TestimonialsCarouselData }) {
  const { title, items } = data
  const [idx, setIdx] = useState(0)
  const t = items[idx]

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <MotionFadeUp>
          <div className="min-h-[200px] flex flex-col items-center gap-6">
            <p className="text-2xl leading-relaxed text-[var(--text)] max-w-2xl italic">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex items-center gap-3">
              {t.photoUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={t.photoUrl} alt="" className="w-12 h-12 rounded-full object-cover" />
              ) : null}
              <div className="text-left">
                <div className="text-sm font-semibold text-[var(--text)]">{t.name}</div>
                {t.role && <div className="text-xs text-[var(--muted-foreground)]">{t.role}</div>}
              </div>
            </div>
          </div>
        </MotionFadeUp>
        <div className="flex justify-center gap-2 mt-8">
          {items.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              aria-label={`후기 ${i + 1}`}
              className="w-2 h-2 rounded-full transition-opacity"
              style={{ background: 'var(--accent)', opacity: i === idx ? 1 : 0.3 }}
            />
          ))}
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <button type="button" onClick={() => setIdx((i) => (i - 1 + items.length) % items.length)}
            className="rounded-full w-9 h-9 border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            aria-label="이전">←</button>
          <button type="button" onClick={() => setIdx((i) => (i + 1) % items.length)}
            className="rounded-full w-9 h-9 border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]"
            aria-label="다음">→</button>
        </div>
      </div>
    </section>
  )
}
