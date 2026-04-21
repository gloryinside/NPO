'use client'
import type {
  TestimonialsCardsData, TestimonialsCarouselData, TestimonialsWallData,
  TestimonialsQuoteLargeData, TestimonialsVideoData,
} from '@/lib/landing-variants/testimonials-schemas'
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

type TextTestimonialItem = { name: string; role?: string; quote: string; photoUrl?: string }
type TextTestimonialData = { title?: string; items: TextTestimonialItem[] }

function TextBasedTestimonialsForm({ data, onChange, minItems }: {
  data: TextTestimonialData
  onChange: (d: TextTestimonialData) => void
  minItems: number
}) {
  function update(i: number, partial: Partial<TextTestimonialItem>) {
    onChange({ ...data, items: data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it) })
  }
  function add() {
    onChange({ ...data, items: [...data.items, { name: '', role: '', quote: '' }] })
  }
  function remove(i: number) {
    if (data.items.length <= minItems) return
    onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) })
  }

  return <>
    <Field label="섹션 제목">
      <input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} />
    </Field>
    {data.items.map((item, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">후기 {i + 1}</span>
          {data.items.length > minItems && (
            <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>
          )}
        </div>
        <Field label="이름"><input className={inputCls} value={item.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
        <Field label="역할/관계 (선택)"><input className={inputCls} value={item.role ?? ''} onChange={(e) => update(i, { role: e.target.value })} placeholder="정기 후원자" /></Field>
        <Field label="후기"><textarea className={textareaCls} value={item.quote} onChange={(e) => update(i, { quote: e.target.value })} /></Field>
        <Field label="사진 URL (선택)"><ImageUploadField value={item.photoUrl ?? ''} onChange={(url) => update(i, { photoUrl: url })} /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 후기 추가</button>
  </>
}

export function TestimonialsCardsForm({ data, onChange }: { data: TestimonialsCardsData; onChange: (d: TestimonialsCardsData) => void }) {
  return <TextBasedTestimonialsForm data={data} onChange={(d) => onChange(d as TestimonialsCardsData)} minItems={1} />
}
export function TestimonialsCarouselForm({ data, onChange }: { data: TestimonialsCarouselData; onChange: (d: TestimonialsCarouselData) => void }) {
  return <TextBasedTestimonialsForm data={data} onChange={(d) => onChange(d as TestimonialsCarouselData)} minItems={1} />
}
export function TestimonialsWallForm({ data, onChange }: { data: TestimonialsWallData; onChange: (d: TestimonialsWallData) => void }) {
  return <TextBasedTestimonialsForm data={data} onChange={(d) => onChange(d as TestimonialsWallData)} minItems={3} />
}
export function TestimonialsQuoteLargeForm({ data, onChange }: { data: TestimonialsQuoteLargeData; onChange: (d: TestimonialsQuoteLargeData) => void }) {
  return <TextBasedTestimonialsForm data={data} onChange={(d) => onChange(d as TestimonialsQuoteLargeData)} minItems={1} />
}

export function TestimonialsVideoForm({ data, onChange }: { data: TestimonialsVideoData; onChange: (d: TestimonialsVideoData) => void }) {
  function update(i: number, partial: Partial<TestimonialsVideoData['items'][0]>) {
    onChange({ ...data, items: data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it) })
  }
  function add() { onChange({ ...data, items: [...data.items, { name: '', role: '', thumbnailUrl: '', videoUrl: '' }] }) }
  function remove(i: number) { if (data.items.length > 1) onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.items.map((item, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">영상 {i + 1}</span>
          {data.items.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="이름"><input className={inputCls} value={item.name} onChange={(e) => update(i, { name: e.target.value })} /></Field>
        <Field label="역할 (선택)"><input className={inputCls} value={item.role ?? ''} onChange={(e) => update(i, { role: e.target.value })} /></Field>
        <Field label="썸네일 이미지"><ImageUploadField value={item.thumbnailUrl} onChange={(url) => update(i, { thumbnailUrl: url })} /></Field>
        <Field label="비디오 URL (YouTube watch URL 권장)"><input className={inputCls} value={item.videoUrl} onChange={(e) => update(i, { videoUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." /></Field>
        <Field label="요약 인용 (선택)"><textarea className={textareaCls} value={item.quote ?? ''} onChange={(e) => update(i, { quote: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 영상 추가</button>
  </>
}
