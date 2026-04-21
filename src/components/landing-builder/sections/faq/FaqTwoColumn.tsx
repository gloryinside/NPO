'use client'
import { useState } from 'react'
import type { FaqBaseData } from '@/lib/landing-variants/faq-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function FaqTwoColumn({ data }: { data: FaqBaseData }) {
  const { title, items } = data
  const [openKeys, setOpenKeys] = useState<Set<number>>(new Set([0]))
  const toggle = (i: number) => {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((it, i) => {
            const open = openKeys.has(i)
            return (
              <MotionFadeUp key={i} delay={i * 0.03}>
                <div className="border border-[var(--border)] bg-[var(--bg)] h-full"
                  style={{ borderRadius: 'var(--radius-card)' }}>
                  <button type="button" onClick={() => toggle(i)}
                    aria-expanded={open}
                    className="w-full flex items-start justify-between gap-3 px-5 py-4 text-left">
                    <span className="text-sm font-semibold text-[var(--text)]">{it.q}</span>
                    <span className="text-[var(--accent)] text-lg flex-shrink-0" aria-hidden>{open ? '−' : '+'}</span>
                  </button>
                  {open && (
                    <div className="px-5 pb-5 text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
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
