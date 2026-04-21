'use client'
import type {
  ImpactAlternatingData, ImpactZigzagData, ImpactCardsData, ImpactStorytellingData,
  ImpactBeforeAfterData,
} from '@/lib/landing-variants/impact-schemas'
import { ImageUploadField } from '../ImageUploadField'

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

type ImpactBlockItem = {
  headline: string
  body: string
  imageUrl?: string
  imagePosition?: 'left' | 'right' | 'none'
}
type ImpactBlockData = { title?: string; blocks: ImpactBlockItem[] }

function ImpactBlocksForm({ data, onChange }: { data: ImpactBlockData; onChange: (d: ImpactBlockData) => void }) {
  function update(i: number, partial: Partial<ImpactBlockItem>) {
    onChange({ ...data, blocks: data.blocks.map((b, idx) => idx === i ? { ...b, ...partial } : b) })
  }
  function add() { onChange({ ...data, blocks: [...data.blocks, { headline: '', body: '', imagePosition: 'left' }] }) }
  function remove(i: number) { if (data.blocks.length > 1) onChange({ ...data, blocks: data.blocks.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.blocks.map((block, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">블록 {i + 1}</span>
          {data.blocks.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="헤드라인"><input className={inputCls} value={block.headline} onChange={(e) => update(i, { headline: e.target.value })} /></Field>
        <Field label="본문"><textarea className={textareaCls} value={block.body} onChange={(e) => update(i, { body: e.target.value })} /></Field>
        <Field label="이미지"><ImageUploadField value={block.imageUrl ?? ''} onChange={(url) => update(i, { imageUrl: url })} /></Field>
        <Field label="이미지 위치">
          <select title="이미지 위치" className={inputCls} value={block.imagePosition ?? 'left'}
            onChange={(e) => update(i, { imagePosition: e.target.value as 'left'|'right'|'none' })}>
            <option value="left">왼쪽</option><option value="right">오른쪽</option><option value="none">이미지 없음</option>
          </select>
        </Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 블록 추가</button>
  </>
}

export function ImpactAlternatingForm({ data, onChange }: { data: ImpactAlternatingData; onChange: (d: ImpactAlternatingData) => void }) {
  return <ImpactBlocksForm data={data} onChange={(d) => onChange(d as ImpactAlternatingData)} />
}
export function ImpactZigzagForm({ data, onChange }: { data: ImpactZigzagData; onChange: (d: ImpactZigzagData) => void }) {
  return <ImpactBlocksForm data={data} onChange={(d) => onChange(d as ImpactZigzagData)} />
}
export function ImpactCardsForm({ data, onChange }: { data: ImpactCardsData; onChange: (d: ImpactCardsData) => void }) {
  return <ImpactBlocksForm data={data} onChange={(d) => onChange(d as ImpactCardsData)} />
}
export function ImpactStorytellingForm({ data, onChange }: { data: ImpactStorytellingData; onChange: (d: ImpactStorytellingData) => void }) {
  return <ImpactBlocksForm data={data} onChange={(d) => onChange(d as ImpactStorytellingData)} />
}

export function ImpactBeforeAfterForm({ data, onChange }: { data: ImpactBeforeAfterData; onChange: (d: ImpactBeforeAfterData) => void }) {
  function update(i: number, partial: Partial<ImpactBeforeAfterData['blocks'][0]>) {
    onChange({ ...data, blocks: data.blocks.map((b, idx) => idx === i ? { ...b, ...partial } : b) })
  }
  function add() {
    onChange({ ...data, blocks: [...data.blocks, { headline: '', body: '', beforeImageUrl: '', afterImageUrl: '', beforeLabel: 'Before', afterLabel: 'After' }] })
  }
  function remove(i: number) { if (data.blocks.length > 1) onChange({ ...data, blocks: data.blocks.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.blocks.map((block, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">블록 {i + 1}</span>
          {data.blocks.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="헤드라인"><input className={inputCls} value={block.headline} onChange={(e) => update(i, { headline: e.target.value })} /></Field>
        <Field label="설명 (선택)"><textarea className={textareaCls} value={block.body ?? ''} onChange={(e) => update(i, { body: e.target.value })} /></Field>
        <Field label="Before 이미지"><ImageUploadField value={block.beforeImageUrl} onChange={(url) => update(i, { beforeImageUrl: url })} /></Field>
        <Field label="After 이미지"><ImageUploadField value={block.afterImageUrl} onChange={(url) => update(i, { afterImageUrl: url })} /></Field>
        <Field label="Before 라벨"><input className={inputCls} value={block.beforeLabel ?? 'Before'} onChange={(e) => update(i, { beforeLabel: e.target.value })} /></Field>
        <Field label="After 라벨"><input className={inputCls} value={block.afterLabel ?? 'After'} onChange={(e) => update(i, { afterLabel: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 블록 추가</button>
  </>
}
