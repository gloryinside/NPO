'use client'
import { useEffect, useState } from 'react'
import type { HeroFullscreenVideoData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

/**
 * G-54: 모바일(≤768px)은 비디오 대신 posterUrl 정적 이미지를 렌더 →
 * 3G 환경 LCP 개선. 데스크톱만 비디오 autoplay.
 * reduced-motion 감지 시에도 비디오 정지 처리.
 */
export function HeroFullscreenVideo({ data }: { data: HeroFullscreenVideoData }) {
  const { videoUrl, posterUrl, overlayOpacity, showMuteToggle, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const [muted, setMuted] = useState(true)
  const [videoEnabled, setVideoEnabled] = useState(false)  // SSR 시 false → 클라이언트에서 감지

  useEffect(() => {
    const mqDesktop = window.matchMedia('(min-width: 769px)')
    const mqReduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setVideoEnabled(mqDesktop.matches && !mqReduced.matches)
    update()
    mqDesktop.addEventListener('change', update)
    mqReduced.addEventListener('change', update)
    return () => {
      mqDesktop.removeEventListener('change', update)
      mqReduced.removeEventListener('change', update)
    }
  }, [])

  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'
  const op = Math.max(0, Math.min(1, overlayOpacity / 100))

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      {videoEnabled ? (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={videoUrl}
          poster={posterUrl}
          autoPlay
          muted={muted}
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={posterUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          aria-hidden="true"
        />
      )}
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
      {showMuteToggle && videoEnabled && (
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          className="absolute bottom-6 right-6 z-20 rounded-full w-10 h-10 bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </section>
  )
}
