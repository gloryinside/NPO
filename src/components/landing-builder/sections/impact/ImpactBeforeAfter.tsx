'use client'
import { useRef, useState } from 'react'
import type { ImpactBeforeAfterData } from '@/lib/landing-variants/impact-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function BeforeAfterSlider({
  beforeUrl, afterUrl, beforeLabel, afterLabel,
}: { beforeUrl: string; afterUrl: string; beforeLabel: string; afterLabel: string }) {
  const [pos, setPos] = useState(50)
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  function updateFromClientX(clientX: number) {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    setPos(p)
  }

  return (
    <div ref={ref}
      className="relative w-full aspect-video overflow-hidden cursor-ew-resize select-none bg-[var(--surface-2)]"
      style={{ borderRadius: 'var(--radius-card)' }}
      onPointerDown={(e) => { dragging.current = true; updateFromClientX(e.clientX) }}
      onPointerMove={(e) => { if (dragging.current) updateFromClientX(e.clientX) }}
      onPointerUp={() => { dragging.current = false }}
      onPointerLeave={() => { dragging.current = false }}
      role="slider"
      aria-label="Before/After 비교"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={afterUrl} alt={afterLabel} className="absolute inset-0 w-full h-full object-cover pointer-events-none" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={beforeUrl} alt={beforeLabel} className="absolute inset-0 w-full h-full object-cover"
          style={{ width: `${100 / (pos / 100 || 0.01)}%`, maxWidth: 'none' }} />
      </div>
      <div className="absolute top-2 left-2 text-xs font-semibold text-white px-2 py-1 rounded bg-black/60 pointer-events-none">
        {beforeLabel}
      </div>
      <div className="absolute top-2 right-2 text-xs font-semibold text-white px-2 py-1 rounded bg-black/60 pointer-events-none">
        {afterLabel}
      </div>
      <div className="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none" style={{ left: `${pos}%` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white flex items-center justify-center text-[var(--accent)] text-xs font-bold">
          ⇆
        </div>
      </div>
    </div>
  )
}

export function ImpactBeforeAfter({ data }: { data: ImpactBeforeAfterData }) {
  const { title, blocks } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="space-y-16">
          {blocks.map((block, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <h3 className="text-xl font-semibold text-[var(--text)] mb-2">{block.headline}</h3>
              {block.body && <p className="text-sm text-[var(--muted-foreground)] mb-5">{block.body}</p>}
              <BeforeAfterSlider
                beforeUrl={block.beforeImageUrl}
                afterUrl={block.afterImageUrl}
                beforeLabel={block.beforeLabel ?? 'Before'}
                afterLabel={block.afterLabel ?? 'After'}
              />
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
