'use client'
import type { TiersRecommendedData, TiersPricingTableData } from '@/lib/landing-variants/tiers-schemas'

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

type RecTierData = TiersRecommendedData | TiersPricingTableData

export function TiersRecommendedForm({
  data, onChange, showBenefits = false,
}: {
  data: RecTierData
  onChange: (d: RecTierData) => void
  showBenefits?: boolean
}) {
  function updateTier(i: number, partial: Partial<RecTierData['tiers'][0]>) {
    onChange({ ...data, tiers: data.tiers.map((t, idx) => idx === i ? { ...t, ...partial } : t) })
  }
  function addTier() {
    onChange({ ...data, tiers: [...data.tiers, { amount: 50000, icon: '⭐', label: '별 후원자', description: '' }] })
  }
  function removeTier(i: number) {
    if (data.tiers.length > 1) onChange({ ...data, tiers: data.tiers.filter((_, idx) => idx !== i) })
  }

  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    <Field label="서브 타이틀 (선택)"><input className={inputCls} value={data.subtitle ?? ''} onChange={(e) => onChange({ ...data, subtitle: e.target.value })} /></Field>
    <Field label={`추천 등급 인덱스 (0 ~ ${data.tiers.length - 1})`}>
      <input type="number" className={inputCls} min={0} max={Math.max(0, data.tiers.length - 1)}
        value={data.recommendedIndex ?? 1}
        onChange={(e) => onChange({ ...data, recommendedIndex: Number(e.target.value) })} />
    </Field>
    {data.tiers.map((tier, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">등급 {i} {(data.recommendedIndex ?? 1) === i ? '★ 추천' : ''}</span>
          {data.tiers.length > 1 && <button type="button" onClick={() => removeTier(i)} className={removeBtnCls}>삭제</button>}
        </div>
        <Field label="아이콘"><input className={inputCls} value={tier.icon ?? ''} onChange={(e) => updateTier(i, { icon: e.target.value })} /></Field>
        <Field label="금액 (원)"><input type="number" className={inputCls} value={tier.amount} onChange={(e) => updateTier(i, { amount: Number(e.target.value) })} /></Field>
        <Field label="등급명"><input className={inputCls} value={tier.label} onChange={(e) => updateTier(i, { label: e.target.value })} /></Field>
        <Field label="설명"><textarea className={textareaCls} value={tier.description} onChange={(e) => updateTier(i, { description: e.target.value })} /></Field>
        {showBenefits && (
          <Field label="혜택 (줄바꿈으로 구분)">
            <textarea className={textareaCls}
              value={(tier.benefits ?? []).join('\n')}
              onChange={(e) => updateTier(i, { benefits: e.target.value.split('\n').filter((s) => s.trim()) })}
              placeholder="월간 리포트&#10;연말 감사장" />
          </Field>
        )}
      </div>
    ))}
    <button type="button" onClick={addTier} className={addBtnCls}>+ 등급 추가</button>
  </>
}
