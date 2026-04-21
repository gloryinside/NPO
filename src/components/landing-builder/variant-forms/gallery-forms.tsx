'use client'
import type { GalleryBaseData } from '@/lib/landing-variants/gallery-schemas'
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

export function GalleryForm({ data, onChange }: { data: GalleryBaseData; onChange: (d: GalleryBaseData) => void }) {
  function update(i: number, partial: Partial<GalleryBaseData['images'][0]>) {
    onChange({ ...data, images: data.images.map((img, idx) => idx === i ? { ...img, ...partial } : img) })
  }
  function add() { onChange({ ...data, images: [...data.images, { url: '', alt: '' }] }) }
  function remove(i: number) { if (data.images.length > 1) onChange({ ...data, images: data.images.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.images.map((img, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">이미지 {i + 1}</span>
          {data.images.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="이미지"><ImageUploadField value={img.url} onChange={(url) => update(i, { url })} /></Field>
        <Field label="대체 텍스트 (alt, 필수)"><input className={inputCls} value={img.alt} onChange={(e) => update(i, { alt: e.target.value })} /></Field>
        <Field label="캡션 (선택)"><input className={inputCls} value={img.caption ?? ''} onChange={(e) => update(i, { caption: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 이미지 추가</button>
  </>
}
