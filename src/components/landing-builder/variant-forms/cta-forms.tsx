'use client'
import type {
  CtaBannerData, CtaGradientData, CtaSplitData, CtaUrgencyData, CtaFullscreenData,
} from '@/lib/landing-variants/cta-schemas'
import { ImageUploadField } from '../ImageUploadField'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[80px] resize-y`

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-[var(--muted-foreground)]">{label}</label>
      {children}
    </div>
  )
}

function CtaSharedFields<T extends { headline: string; body?: string; buttonText: string; buttonUrl?: string }>({
  data, onChange,
}: { data: T; onChange: (d: T) => void }) {
  const p = (partial: Partial<T>) => onChange({ ...data, ...partial })
  return <>
    <Field label="헤드라인"><input className={inputCls} value={data.headline} onChange={(e) => p({ headline: e.target.value } as Partial<T>)} /></Field>
    <Field label="본문"><textarea className={textareaCls} value={data.body ?? ''} onChange={(e) => p({ body: e.target.value } as Partial<T>)} /></Field>
    <Field label="버튼 텍스트"><input className={inputCls} value={data.buttonText} onChange={(e) => p({ buttonText: e.target.value } as Partial<T>)} /></Field>
    <Field label="버튼 URL"><input className={inputCls} value={data.buttonUrl ?? ''} onChange={(e) => p({ buttonUrl: e.target.value } as Partial<T>)} placeholder="#campaigns" /></Field>
  </>
}

export function CtaBannerForm({ data, onChange }: { data: CtaBannerData; onChange: (d: CtaBannerData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

export function CtaGradientForm({ data, onChange }: { data: CtaGradientData; onChange: (d: CtaGradientData) => void }) {
  return <>
    <Field label="그라디언트 시작 (hex)"><input className={inputCls} value={data.gradientFrom} onChange={(e) => onChange({ ...data, gradientFrom: e.target.value })} /></Field>
    <Field label="그라디언트 끝 (hex)"><input className={inputCls} value={data.gradientTo} onChange={(e) => onChange({ ...data, gradientTo: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

export function CtaSplitForm({ data, onChange }: { data: CtaSplitData; onChange: (d: CtaSplitData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="보조 라벨 (예: 전화 문의)"><input className={inputCls} value={data.secondaryLabel ?? ''} onChange={(e) => onChange({ ...data, secondaryLabel: e.target.value })} /></Field>
    <Field label="보조 값 (예: 02-000-0000)"><input className={inputCls} value={data.secondaryValue ?? ''} onChange={(e) => onChange({ ...data, secondaryValue: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

export function CtaUrgencyForm({ data, onChange }: { data: CtaUrgencyData; onChange: (d: CtaUrgencyData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="마감일">
      <input className={inputCls} type="datetime-local"
        value={data.deadlineIso.slice(0, 16)}
        onChange={(e) => onChange({ ...data, deadlineIso: new Date(e.target.value).toISOString() })} />
    </Field>
    <Field label="목표 금액 (원)">
      <input type="number" className={inputCls} min={0} value={data.goalAmount}
        onChange={(e) => onChange({ ...data, goalAmount: Number(e.target.value) })} />
    </Field>
    <Field label="현재 모금액 (원)">
      <input type="number" className={inputCls} min={0} value={data.raisedAmount}
        onChange={(e) => onChange({ ...data, raisedAmount: Number(e.target.value) })} />
    </Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

export function CtaFullscreenForm({ data, onChange }: { data: CtaFullscreenData; onChange: (d: CtaFullscreenData) => void }) {
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}
