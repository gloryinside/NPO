'use client'
import { useRef } from 'react'
import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function GalleryCarousel({ data }: { data: GalleryBaseData }) {
  const { title, images } = data
  const ref = useRef<HTMLDivElement>(null)

  function scroll(dir: -1 | 1) {
    const el = ref.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="relative">
          <div ref={ref} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4"
            style={{ scrollbarWidth: 'none' }}>
            {images.map((img, i) => (
              <figure key={i} className="snap-start flex-shrink-0 w-[80%] md:w-[50%] lg:w-[33%] overflow-hidden bg-[var(--surface)]"
                style={{ borderRadius: 'var(--radius-card)', boxShadow: 'var(--shadow-card)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.alt} className="w-full aspect-[4/3] object-cover" />
                {img.caption && <figcaption className="px-4 py-3 text-sm text-[var(--muted-foreground)]">{img.caption}</figcaption>}
              </figure>
            ))}
          </div>
          <button type="button" onClick={() => scroll(-1)}
            aria-label="이전"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]">←</button>
          <button type="button" onClick={() => scroll(1)}
            aria-label="다음"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]">→</button>
        </div>
      </div>
    </section>
  )
}
