'use client'
import type { LogosBaseData } from '@/lib/landing-variants/logos-schemas'
import { ImageUploadField } from '../ImageUploadField'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
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

export function LogosForm({ data, onChange }: { data: LogosBaseData; onChange: (d: LogosBaseData) => void }) {
  function update(i: number, partial: Partial<LogosBaseData['logos'][0]>) {
    onChange({ ...data, logos: data.logos.map((l, idx) => idx === i ? { ...l, ...partial } : l) })
  }
  function add() { onChange({ ...data, logos: [...data.logos, { name: '', imageUrl: '' }] }) }
  function remove(i: number) { if (data.logos.length > 2) onChange({ ...data, logos: data.logos.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목 (선택)"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.logos.map((logo, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">로고 {i + 1}</span>
          {data.logos.length > 2 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="기관명"><input className={inputCls} value={logo.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
        <Field label="로고 이미지"><ImageUploadField value={logo.imageUrl} onChange={(url) => update(i, { imageUrl: url })} /></Field>
        <Field label="링크 URL (선택)"><input className={inputCls} value={logo.url ?? ''} onChange={(e) => update(i, { url: e.target.value })} placeholder="https://..." /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 로고 추가</button>
  </>
}
