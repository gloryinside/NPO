'use client'
import type { StatsBigData } from '@/lib/landing-variants/stats-schemas'

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

/** StatsBig 전용 — gradient 체크박스 추가. 나머지 variant는 기존 StatsForm 재사용 */
export function StatsBigForm({ data, onChange }: { data: StatsBigData; onChange: (d: StatsBigData) => void }) {
  function updateItem(i: number, partial: Partial<StatsBigData['items'][0]>) {
    onChange({ ...data, items: data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it) })
  }
  function addItem() { onChange({ ...data, items: [...data.items, { icon: '✨', value: '0', label: '항목' }] }) }
  function removeItem(i: number) { onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.items.map((item, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">항목 {i + 1}</span>
          <button type="button" onClick={() => removeItem(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="아이콘 (이모지)"><input className={inputCls} value={item.icon ?? ''} onChange={(e) => updateItem(i, { icon: e.target.value })} /></Field>
        <Field label="값"><input className={inputCls} value={item.value} onChange={(e) => updateItem(i, { value: e.target.value })} /></Field>
        <Field label="라벨"><input className={inputCls} value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addItem} className={addBtnCls}>+ 항목 추가</button>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.gradient} onChange={(e) => onChange({ ...data, gradient: e.target.checked })} className="accent-[var(--accent)]" />
      그라디언트 배경 사용
    </label>
  </>
}
