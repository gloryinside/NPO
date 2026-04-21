'use client'
import { useState } from 'react'
import type { FaqBaseData } from '@/lib/landing-variants/faq-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function FaqAccordion({ data }: { data: FaqBaseData }) {
  const { title, items } = data
  const [openIdx, setOpenIdx] = useState<number | null>(0)
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="space-y-3">
          {items.map((it, i) => {
            const open = openIdx === i
            return (
              <MotionFadeUp key={i} delay={i * 0.04}>
                <div className="border border-[var(--border)] bg-[var(--surface)] overflow-hidden"
                  style={{ borderRadius: 'var(--radius-card)' }}>
                  <button type="button" onClick={() => setOpenIdx(open ? null : i)}
                    aria-expanded={open}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-[var(--surface-2)] transition-colors">
                    <span className="text-sm font-semibold text-[var(--text)]">{it.q}</span>
                    <span className="text-[var(--accent)] text-lg flex-shrink-0" aria-hidden>{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 pt-0 text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
                      {it.a}
                    </div>
                  )}
                </div>
              </MotionFadeUp>
            )
          })}
        </div>
      </div>
    </section>
  )
}
