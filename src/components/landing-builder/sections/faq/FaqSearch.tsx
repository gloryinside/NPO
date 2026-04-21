'use client'
import { useState } from 'react'
import type { FaqBaseData } from '@/lib/landing-variants/faq-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function FaqSearch({ data }: { data: FaqBaseData }) {
  const { title, items } = data
  const [query, setQuery] = useState('')
  const [openIdx, setOpenIdx] = useState<number | null>(null)

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter((it) => it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q))
    : items

  return (
    <section className="border-b border-[var(--border)]" style={{ background: 'var(--gradient-soft)' }}>
      <div className="max-w-3xl mx-auto px-6 py-16">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-6 text-center text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <MotionFadeUp>
          <div className="relative mb-8">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="키워드로 검색하세요 (예: 영수증, 정기후원)"
              aria-label="FAQ 검색"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] px-12 py-3 text-sm outline-none focus:border-[var(--accent)]"
              style={{ boxShadow: 'var(--shadow-card)' }}
            />
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]" aria-hidden>🔍</span>
          </div>
        </MotionFadeUp>
        {filtered.length === 0 ? (
          <p className="text-center text-sm text-[var(--muted-foreground)]">
            &ldquo;{query}&rdquo;에 대한 결과가 없습니다.
          </p>
        ) : (
          <div className="space-y-3">
            {filtered.map((it, i) => {
              const open = openIdx === i
              return (
                <div key={i} className="border border-[var(--border)] bg-[var(--surface)]"
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
        )}
      </div>
    </section>
  )
}
