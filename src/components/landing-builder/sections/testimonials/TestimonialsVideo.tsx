'use client'
import { useState } from 'react'
import type { TestimonialsVideoData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TestimonialsVideo({ data }: { data: TestimonialsVideoData }) {
  const { title, items } = data
  const [playing, setPlaying] = useState<string | null>(null)

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {items.map((t, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <button type="button" onClick={() => setPlaying(t.videoUrl)}
                className="text-left w-full group"
                aria-label={`${t.name}의 영상 후기 재생`}>
                <div className="relative aspect-video overflow-hidden bg-[var(--bg)]"
                  style={{ borderRadius: 'var(--radius-card)' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.thumbnailUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                      <span className="text-[var(--accent)] text-2xl">▶</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="text-sm font-semibold text-[var(--text)]">{t.name}</div>
                  {t.role && <div className="text-xs text-[var(--muted-foreground)]">{t.role}</div>}
                  {t.quote && <p className="text-xs text-[var(--muted-foreground)] mt-1 line-clamp-2">&ldquo;{t.quote}&rdquo;</p>}
                </div>
              </button>
            </MotionFadeUp>
          ))}
        </div>
      </div>

      {playing && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPlaying(null)} role="dialog" aria-modal>
          <div className="relative w-full max-w-4xl aspect-video">
            <button type="button" onClick={() => setPlaying(null)}
              aria-label="닫기"
              className="absolute -top-10 right-0 text-white text-xl">✕</button>
            <iframe src={playing.replace('watch?v=', 'embed/')} title="video" className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        </div>
      )}
    </section>
  )
}
