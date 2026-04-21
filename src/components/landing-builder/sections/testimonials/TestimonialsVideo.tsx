'use client'
import { useState } from 'react'
import type { TestimonialsVideoData } from '@/lib/landing-variants/testimonials-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

type VideoKind = { kind: 'youtube'; embed: string } | { kind: 'vimeo'; embed: string } | { kind: 'mp4'; src: string } | { kind: 'unknown'; src: string }

/** URL에서 플랫폼을 감지해 적절한 플레이어 소스 반환 */
function detectVideo(url: string): VideoKind {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '')
    // YouTube
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = u.searchParams.get('v')
      if (v) return { kind: 'youtube', embed: `https://www.youtube.com/embed/${v}` }
    }
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (id) return { kind: 'youtube', embed: `https://www.youtube.com/embed/${id}` }
    }
    if (host === 'youtube.com' && u.pathname.startsWith('/embed/')) {
      return { kind: 'youtube', embed: url }
    }
    // Vimeo
    if (host === 'vimeo.com') {
      const id = u.pathname.split('/').filter(Boolean)[0]
      if (id && /^\d+$/.test(id)) return { kind: 'vimeo', embed: `https://player.vimeo.com/video/${id}` }
    }
    if (host === 'player.vimeo.com') return { kind: 'vimeo', embed: url }
    // mp4/webm 직접 호스팅
    if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) {
      return { kind: 'mp4', src: url }
    }
  } catch {
    // URL 파싱 실패 시 unknown
  }
  return { kind: 'unknown', src: url }
}

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

      {playing && (() => {
        const detected = detectVideo(playing)
        return (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
            onClick={() => setPlaying(null)} role="dialog" aria-modal>
            <div className="relative w-full max-w-4xl aspect-video" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setPlaying(null)}
                aria-label="닫기"
                className="absolute -top-10 right-0 text-white text-xl">✕</button>
              {(detected.kind === 'youtube' || detected.kind === 'vimeo') && (
                <iframe
                  src={`${detected.embed}?autoplay=1`}
                  title="video"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
              {detected.kind === 'mp4' && (
                <video src={detected.src} className="w-full h-full bg-black" controls autoPlay />
              )}
              {detected.kind === 'unknown' && (
                <div className="w-full h-full bg-black flex items-center justify-center text-white text-sm p-6 text-center">
                  <div>
                    <p className="mb-3">지원되지 않는 형식의 영상입니다.</p>
                    <a href={playing} target="_blank" rel="noopener noreferrer"
                      className="underline text-[var(--accent)]">새 창에서 열기 →</a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })()}
    </section>
  )
}
