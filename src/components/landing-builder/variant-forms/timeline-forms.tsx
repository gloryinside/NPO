'use client'
import type { TimelineBaseData } from '@/lib/landing-variants/timeline-schemas'
import { ImageUploadField } from '../ImageUploadField'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[80px] resize-y`
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

export function TimelineForm({ data, onChange, showImage = false }: {
  data: TimelineBaseData; onChange: (d: TimelineBaseData) => void; showImage?: boolean
}) {
  function update(i: number, partial: Partial<TimelineBaseData['events'][0]>) {
    onChange({ ...data, events: data.events.map((e, idx) => idx === i ? { ...e, ...partial } : e) })
  }
  function add() { onChange({ ...data, events: [...data.events, { year: '', title: '', body: '' }] }) }
  function remove(i: number) { if (data.events.length > 1) onChange({ ...data, events: data.events.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.events.map((event, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">이벤트 {i + 1}</span>
          {data.events.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="연도/시기"><input className={inputCls} value={event.year} onChange={(e) => update(i, { year: e.target.value })} placeholder="2024" /></Field>
        <Field label="제목"><input className={inputCls} value={event.title} onChange={(e) => update(i, { title: e.target.value })} /></Field>
        <Field label="설명 (선택)"><textarea className={textareaCls} value={event.body ?? ''} onChange={(e) => update(i, { body: e.target.value })} /></Field>
        {showImage && (
          <Field label="이미지 (선택)"><ImageUploadField value={event.imageUrl ?? ''} onChange={(url) => update(i, { imageUrl: url })} /></Field>
        )}
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 이벤트 추가</button>
  </>
}
