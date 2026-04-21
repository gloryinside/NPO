'use client'
import { useRef } from 'react'
import type { CampaignsBaseData } from '@/lib/landing-variants/campaigns-schemas'
import { CampaignCard, type CampaignRow } from './CampaignCard'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CampaignsCarousel({ data, campaigns }: { data: CampaignsBaseData; campaigns: CampaignRow[] }) {
  const { title = '진행 중인 캠페인', subtitle, showProgress = true, maxCount = 6 } = data
  const visible = campaigns.slice(0, maxCount)
  const ref = useRef<HTMLDivElement>(null)
  function scroll(dir: -1 | 1) {
    ref.current?.scrollBy({ left: dir * (ref.current.clientWidth * 0.9), behavior: 'smooth' })
  }

  return (
    <section id="campaigns" className="border-b border-[var(--border)]">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <MotionFadeUp>
          <h2 className="text-2xl font-bold mb-2 text-center text-[var(--text)]">{title}</h2>
          {subtitle && <p className="text-sm text-center mb-10 text-[var(--muted-foreground)]">{subtitle}</p>}
        </MotionFadeUp>
        {!subtitle && <div className="mb-10" />}

        {visible.length === 0 ? (
          <p className="text-center py-12 text-[var(--muted-foreground)]">진행 중인 캠페인이 없습니다.</p>
        ) : (
          <div className="relative">
            <div ref={ref} className="flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth pb-4"
              style={{ scrollbarWidth: 'none' }}>
              {visible.map((c) => (
                <div key={c.id} className="snap-start flex-shrink-0 w-[85%] sm:w-[45%] lg:w-[30%]">
                  <CampaignCard campaign={c} showProgress={showProgress} />
                </div>
              ))}
            </div>
            <button type="button" onClick={() => scroll(-1)}
              aria-label="이전"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]">←</button>
            <button type="button" onClick={() => scroll(1)}
              aria-label="다음"
              className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]">→</button>
          </div>
        )}
      </div>
    </section>
  )
}
