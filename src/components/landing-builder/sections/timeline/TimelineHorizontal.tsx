'use client'
import { useEffect, useRef, useState } from 'react'
import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TimelineHorizontal({ data }: { data: TimelineBaseData }) {
  const { title, events } = data
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const update = () => {
      setCanLeft(el.scrollLeft > 4)
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [events.length])

  function scroll(dir: -1 | 1) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
            <div className="relative inline-flex gap-0 pt-4 pb-4 min-w-full">
              <div className="absolute top-6 left-0 right-0 h-0.5 bg-[var(--accent)]/30" aria-hidden />
              {events.map((e, i) => (
                <div key={i} className="relative flex-shrink-0 w-64 px-4">
                  <div className="absolute top-4 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full bg-[var(--accent)] border-4 border-[var(--bg)] z-10" aria-hidden />
                  <div className="mt-14 text-center">
                    <div className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">{e.year}</div>
                    <h3 className="text-sm font-semibold text-[var(--text)] mb-2">{e.title}</h3>
                    {e.body && <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">{e.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {canLeft && (
            <div className="absolute left-0 top-0 bottom-4 w-12 pointer-events-none bg-gradient-to-r from-[var(--bg)] to-transparent" aria-hidden />
          )}
          {canRight && (
            <div className="absolute right-0 top-0 bottom-4 w-12 pointer-events-none bg-gradient-to-l from-[var(--bg)] to-transparent" aria-hidden />
          )}
          <button type="button" onClick={() => scroll(-1)}
            disabled={!canLeft}
            aria-label="이전 이벤트"
            className="absolute left-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-0 disabled:pointer-events-none transition-opacity">←</button>
          <button type="button" onClick={() => scroll(1)}
            disabled={!canRight}
            aria-label="다음 이벤트"
            className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-0 disabled:pointer-events-none transition-opacity">→</button>
        </div>
      </div>
    </section>
  )
}
