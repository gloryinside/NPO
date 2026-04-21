'use client'
import { useRef } from 'react'
import type { TeamBaseData } from '@/lib/landing-variants/team-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function TeamCarousel({ data }: { data: TeamBaseData }) {
  const { title = '우리 팀', members } = data
  const ref = useRef<HTMLDivElement>(null)
  function scroll(dir: -1 | 1) {
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.8, behavior: 'smooth' })
  }

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>
        <div className="relative">
          <div ref={ref} className="flex gap-4 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4"
            style={{ scrollbarWidth: 'none' }}>
            {members.map((m, i) => (
              <figure key={i} className="snap-start flex-shrink-0 w-60 sm:w-72 bg-[var(--surface)] border border-[var(--border)] overflow-hidden"
                style={{ borderRadius: 'var(--radius-card)' }}>
                {m.photoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={m.photoUrl} alt={m.name} className="w-full aspect-[3/4] object-cover" />
                ) : (
                  <div className="w-full aspect-[3/4] bg-gradient-to-br from-[var(--accent-soft)] to-[var(--surface-2)] flex items-center justify-center text-5xl font-bold text-[var(--accent)]">
                    {m.name[0]}
                  </div>
                )}
                <figcaption className="p-4">
                  <div className="font-semibold text-[var(--text)]">{m.name}</div>
                  <div className="text-xs text-[var(--accent)]">{m.role}</div>
                  {m.bio && <p className="text-xs text-[var(--muted-foreground)] mt-2 line-clamp-3">{m.bio}</p>}
                </figcaption>
              </figure>
            ))}
          </div>
          <button type="button" onClick={() => scroll(-1)}
            aria-label="이전"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">←</button>
          <button type="button" onClick={() => scroll(1)}
            aria-label="다음"
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)]">→</button>
        </div>
      </div>
    </section>
  )
}
