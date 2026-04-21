'use client'
import { useEffect, useState } from 'react'
import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { supabaseImage } from '../../shared/supabase-image'

export function GalleryLightbox({ data }: { data: GalleryBaseData }) {
  const { title, images } = data
  const [idx, setIdx] = useState<number | null>(null)

  useEffect(() => {
    if (idx === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIdx(null)
      else if (e.key === 'ArrowRight') setIdx((i) => (i === null ? null : (i + 1) % images.length))
      else if (e.key === 'ArrowLeft') setIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [idx, images.length])

  const current = idx !== null ? images[idx] : null

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <MotionFadeUp key={i} delay={i * 0.03}>
              <button type="button" onClick={() => setIdx(i)}
                aria-label={`확대: ${img.alt}`}
                className="block w-full overflow-hidden bg-[var(--surface)] group" style={{ borderRadius: 'var(--radius-card)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={supabaseImage(img.url, { width: 400, quality: 75 })} alt={img.alt}
                  loading="lazy"
                  className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
              </button>
            </MotionFadeUp>
          ))}
        </div>
      </div>

      {current !== null && idx !== null && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" role="dialog" aria-modal aria-label="이미지 뷰어">
          <button type="button" onClick={() => setIdx(null)}
            aria-label="닫기"
            className="absolute top-6 right-6 text-white text-2xl">✕</button>
          <button type="button"
            onClick={() => setIdx((i) => (i === null ? null : (i - 1 + images.length) % images.length))}
            aria-label="이전"
            className="absolute left-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl">←</button>
          <button type="button"
            onClick={() => setIdx((i) => (i === null ? null : (i + 1) % images.length))}
            aria-label="다음"
            className="absolute right-6 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white text-2xl">→</button>
          <div className="max-w-5xl w-full flex flex-col items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={supabaseImage(current.url, { width: 1920, quality: 85 })} alt={current.alt} className="max-h-[80vh] w-auto object-contain" />
            {current.caption && <p className="text-white/80 text-sm text-center">{current.caption}</p>}
            <p className="text-white/50 text-xs">{idx + 1} / {images.length}</p>
          </div>
        </div>
      )}
    </section>
  )
}
