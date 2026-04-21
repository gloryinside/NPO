'use client'
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { HeroGalleryData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function HeroGallery({ data }: { data: HeroGalleryData }) {
  const { images, intervalMs, overlayOpacity, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const [idx, setIdx] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), intervalMs)
    return () => clearInterval(t)
  }, [images.length, intervalMs, reduce])

  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'
  const op = Math.max(0, Math.min(1, overlayOpacity / 100))

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      {images.map((img, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={i} src={img.url} alt={img.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, rgba(10,10,15,${op}), rgba(10,10,15,${Math.min(op + 0.3, 1)}))` }} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col justify-center">
        <div className={`flex flex-col ${align}`}>
          <MotionFadeUp>
            <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
            </MotionFadeUp>
          )}
          {ctaText && (
            <MotionFadeUp delay={0.2}>
              <a href={ctaUrl || '#'}
                className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-hero)' }}>
                {ctaText} →
              </a>
            </MotionFadeUp>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`슬라이드 ${i + 1}`}
            className="w-2 h-2 rounded-full transition-opacity bg-white"
            style={{ opacity: i === idx ? 1 : 0.4 }}
          />
        ))}
      </div>
    </section>
  )
}
