'use client'
import type { FaqBaseData } from '@/lib/landing-variants/faq-schemas'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[100px] resize-y`
const repeatGroupCls = 'rounded-md border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2'
const removeBtnCls = 'text-xs text-[var(--negative)] hover:opacity-80 transition-opacity'
const addBtnCls = 'w-full rounded-md border-2 border-dashed border-[var(--border)] py-2 text-xs text-[var(--muted-foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)] transition-colors'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  )
}

export function FaqForm({ data, onChange, showCategory = false }: {
  data: FaqBaseData; onChange: (d: FaqBaseData) => void; showCategory?: boolean
}) {
  function update(i: number, partial: Partial<FaqBaseData['items'][0]>) {
    onChange({ ...data, items: data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it) })
  }
  function add() { onChange({ ...data, items: [...data.items, { q: '', a: '' }] }) }
  function remove(i: number) { if (data.items.length > 1) onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.items.map((item, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">Q&A {i + 1}</span>
          {data.items.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="질문"><input className={inputCls} value={item.q} onChange={(e) => update(i, { q: e.target.value })} /></Field>
        <Field label="답변"><textarea className={textareaCls} value={item.a} onChange={(e) => update(i, { a: e.target.value })} /></Field>
        {showCategory && (
          <Field label="카테고리 (선택)"><input className={inputCls} value={item.category ?? ''} onChange={(e) => update(i, { category: e.target.value })} placeholder="영수증" /></Field>
        )}
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ Q&A 추가</button>
  </>
}
