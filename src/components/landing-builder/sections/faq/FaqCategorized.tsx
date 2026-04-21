'use client'
import { useMemo, useState } from 'react'
import type { FaqBaseData } from '@/lib/landing-variants/faq-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function FaqCategorized({ data }: { data: FaqBaseData }) {
  const { title, items } = data
  const categories = useMemo(() => {
    const set = new Set<string>()
    items.forEach((it) => { if (it.category) set.add(it.category) })
    return ['전체', ...Array.from(set)]
  }, [items])
  const [cat, setCat] = useState('전체')
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  const filtered = cat === '전체' ? items : items.filter((it) => it.category === cat)

  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-6 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="flex gap-2 justify-center flex-wrap mb-8">
          {categories.map((c) => (
            <button key={c} type="button" onClick={() => { setCat(c); setOpenIdx(null) }}
              className="rounded-full px-4 py-1.5 text-xs font-medium border transition-colors"
              style={{
                background: cat === c ? 'var(--accent)' : 'var(--surface-2)',
                color: cat === c ? '#fff' : 'var(--muted-foreground)',
                borderColor: cat === c ? 'var(--accent)' : 'var(--border)',
              }}>
              {c}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {filtered.map((it, i) => {
            const open = openIdx === i
            return (
              <div key={`${cat}-${i}`} className="border border-[var(--border)] bg-[var(--surface)]"
                style={{ borderRadius: 'var(--radius-card)' }}>
                <button type="button" onClick={() => setOpenIdx(open ? null : i)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left">
                  <span className="text-sm font-semibold text-[var(--text)]">{it.q}</span>
                  <span className="text-[var(--accent)] text-lg flex-shrink-0" aria-hidden>{open ? '−' : '+'}</span>
                </button>
                {open && (
                  <div className="px-5 pb-5 text-sm leading-relaxed text-[var(--muted-foreground)] whitespace-pre-line">
                    {it.a}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
