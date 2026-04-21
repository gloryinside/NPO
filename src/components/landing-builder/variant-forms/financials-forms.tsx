'use client'
import type {
  FinancialsSummaryData, FinancialsBreakdownData,
  FinancialsTimelineData, FinancialsTransparencyData,
} from '@/lib/landing-variants/financials-schemas'

const inputCls = 'w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]'
const textareaCls = `${inputCls} min-h-[60px] resize-y`
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

export function FinancialsSummaryForm({ data, onChange }: {
  data: FinancialsSummaryData; onChange: (d: FinancialsSummaryData) => void
}) {
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    <Field label="기준 연도"><input type="number" className={inputCls} min={2000} max={2100} value={data.year ?? ''} onChange={(e) => onChange({ ...data, year: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    <Field label="총 모금액 (원)"><input type="number" className={inputCls} min={0} value={data.totalRaised} onChange={(e) => onChange({ ...data, totalRaised: Number(e.target.value) })} /></Field>
    <Field label="총 집행액 (원)"><input type="number" className={inputCls} min={0} value={data.totalUsed} onChange={(e) => onChange({ ...data, totalUsed: Number(e.target.value) })} /></Field>
    <Field label="잔액 (원, 비어 있으면 자동 계산)">
      <input type="number" className={inputCls} min={0} value={data.balance ?? ''}
        onChange={(e) => onChange({ ...data, balance: e.target.value ? Number(e.target.value) : undefined })} />
    </Field>
  </>
}

export function FinancialsBreakdownForm({ data, onChange }: {
  data: FinancialsBreakdownData; onChange: (d: FinancialsBreakdownData) => void
}) {
  function update(i: number, partial: Partial<FinancialsBreakdownData['breakdown'][0]>) {
    onChange({ ...data, breakdown: data.breakdown.map((b, idx) => idx === i ? { ...b, ...partial } : b) })
  }
  function add() { onChange({ ...data, breakdown: [...data.breakdown, { label: '', amount: 0 }] }) }
  function remove(i: number) { if (data.breakdown.length > 2) onChange({ ...data, breakdown: data.breakdown.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    <Field label="기준 연도"><input type="number" className={inputCls} min={2000} max={2100} value={data.year ?? ''} onChange={(e) => onChange({ ...data, year: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    <Field label="총 집행액 (원)"><input type="number" className={inputCls} min={0} value={data.totalUsed} onChange={(e) => onChange({ ...data, totalUsed: Number(e.target.value) })} /></Field>
    {data.breakdown.map((b, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">항목 {i + 1}</span>
          {data.breakdown.length > 2 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="라벨 (예: 사업비)"><input className={inputCls} value={b.label} onChange={(e) => update(i, { label: e.target.value })} /></Field>
        <Field label="금액 (원)"><input type="number" className={inputCls} min={0} value={b.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} /></Field>
        <Field label="색상 (hex, 선택)"><input className={inputCls} value={b.color ?? ''} onChange={(e) => update(i, { color: e.target.value || undefined })} placeholder="#7c3aed" /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 항목 추가</button>
  </>
}

export function FinancialsTimelineForm({ data, onChange }: {
  data: FinancialsTimelineData; onChange: (d: FinancialsTimelineData) => void
}) {
  function update(i: number, partial: Partial<FinancialsTimelineData['years'][0]>) {
    onChange({ ...data, years: data.years.map((y, idx) => idx === i ? { ...y, ...partial } : y) })
  }
  function add() {
    const latest = data.years[data.years.length - 1]?.year ?? new Date().getFullYear() - 1
    onChange({ ...data, years: [...data.years, { year: latest + 1, raised: 0, used: 0 }] })
  }
  function remove(i: number) { if (data.years.length > 1) onChange({ ...data, years: data.years.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.years.map((y, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">연도 {i + 1}</span>
          {data.years.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="연도"><input type="number" className={inputCls} min={2000} max={2100} value={y.year} onChange={(e) => update(i, { year: Number(e.target.value) })} /></Field>
        <Field label="모금액 (원)"><input type="number" className={inputCls} min={0} value={y.raised} onChange={(e) => update(i, { raised: Number(e.target.value) })} /></Field>
        <Field label="사용액 (원)"><input type="number" className={inputCls} min={0} value={y.used} onChange={(e) => update(i, { used: Number(e.target.value) })} /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 연도 추가</button>
  </>
}

export function FinancialsTransparencyForm({ data, onChange }: {
  data: FinancialsTransparencyData; onChange: (d: FinancialsTransparencyData) => void
}) {
  function update(i: number, partial: Partial<FinancialsTransparencyData['items'][0]>) {
    onChange({ ...data, items: data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it) })
  }
  function add() { onChange({ ...data, items: [...data.items, { category: '', amount: 0 }] }) }
  function remove(i: number) { if (data.items.length > 1) onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    <Field label="기준 연도"><input type="number" className={inputCls} min={2000} max={2100} value={data.year ?? ''} onChange={(e) => onChange({ ...data, year: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    <Field label="총 모금액 (원)"><input type="number" className={inputCls} min={0} value={data.totalRaised} onChange={(e) => onChange({ ...data, totalRaised: Number(e.target.value) })} /></Field>
    <Field label="총 집행액 (원)"><input type="number" className={inputCls} min={0} value={data.totalUsed} onChange={(e) => onChange({ ...data, totalUsed: Number(e.target.value) })} /></Field>
    <Field label="감사보고서 URL (선택)"><input className={inputCls} value={data.reportUrl ?? ''} onChange={(e) => onChange({ ...data, reportUrl: e.target.value || undefined })} placeholder="https://.../report.pdf" /></Field>
    {data.items.map((it, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">내역 {i + 1}</span>
          {data.items.length > 1 && <button type="button" onClick={() => remove(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="항목 (예: 아동 교육 지원)"><input className={inputCls} value={it.category} onChange={(e) => update(i, { category: e.target.value })} /></Field>
        <Field label="금액 (원)"><input type="number" className={inputCls} min={0} value={it.amount} onChange={(e) => update(i, { amount: Number(e.target.value) })} /></Field>
        <Field label="비고 (선택)"><textarea className={textareaCls} value={it.note ?? ''} onChange={(e) => update(i, { note: e.target.value || undefined })} /></Field>
        <Field label="증빙 문서 URL (선택)"><input className={inputCls} value={it.documentUrl ?? ''} onChange={(e) => update(i, { documentUrl: e.target.value || undefined })} placeholder="https://..." /></Field>
      </div>
    ))}
    <button type="button" onClick={add} className={addBtnCls}>+ 내역 추가</button>
  </>
}
