'use client'
import type { RichtextQuoteData } from '@/lib/landing-variants/richtext-schemas'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[100px] resize-y`

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  )
}

export function RichtextQuoteForm({ data, onChange }: { data: RichtextQuoteData; onChange: (d: RichtextQuoteData) => void }) {
  return <>
    <Field label="카테고리 라벨 (선택)"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} placeholder="기관 대표 메시지" /></Field>
    <Field label="인용문"><textarea className={textareaCls} value={data.content} onChange={(e) => onChange({ ...data, content: e.target.value })} /></Field>
    <Field label="작성자"><input className={inputCls} value={data.author ?? ''} onChange={(e) => onChange({ ...data, author: e.target.value })} placeholder="기관 대표" /></Field>
  </>
}
