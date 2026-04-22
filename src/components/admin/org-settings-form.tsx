'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import type { OrgSettings } from '@/lib/org/settings'

interface Props {
  initial: OrgSettings
}

export function OrgSettingsForm({ initial }: Props) {
  const [settings, setSettings] = useState<OrgSettings>(initial)
  const [saving, setSaving] = useState(false)

  async function savePartial(partial: Partial<OrgSettings>) {
    setSaving(true)
    const optimistic = { ...settings, ...partial }
    setSettings(optimistic)
    try {
      const res = await fetch('/api/admin/settings/org-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.error ?? '저장 실패')
      }
      const body = (await res.json()) as { settings: OrgSettings }
      setSettings(body.settings)
      toast.success('저장되었습니다')
    } catch (err) {
      // rollback
      setSettings(initial)
      toast.error(err instanceof Error ? err.message : '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">알림·임팩트 설정</h2>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">자동화 이메일 수신과 임팩트 페이지 표시 방식을 조정합니다.</p>
      </div>

      {/* 주간 알림 */}
      <ToggleRow
        label="주간 이탈 위험 알림 이메일"
        description="매주 월요일 오전, 미납/실패 2회 이상 후원자가 3명 이상일 때 기관 contact_email로 발송됩니다."
        checked={settings.weekly_alert_enabled}
        disabled={saving}
        onChange={(v) => savePartial({ weekly_alert_enabled: v })}
      />

      {/* 감사 이메일 */}
      <ToggleRow
        label="캠페인 목표 달성 감사 이메일"
        description="목표 달성으로 마감된 캠페인의 기여 후원자에게 자동으로 감사 메일을 발송합니다."
        checked={settings.campaign_thanks_enabled}
        disabled={saving}
        onChange={(v) => savePartial({ campaign_thanks_enabled: v })}
      />

      {/* 임팩트 단가 */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[var(--text)]">후원자 임팩트 단가</label>
        <p className="text-xs text-[var(--muted-foreground)]">
          후원자 임팩트 페이지의 &ldquo;지원 추정&rdquo; 계산 단가 (원). 예를 들어 10만원이면 누적 후원액을 10만원으로 나눠 &ldquo;지원 건수&rdquo;를 표시합니다.
        </p>
        <NumberInputWithSave
          value={settings.impact_unit_amount}
          disabled={saving}
          onSave={(v) => savePartial({ impact_unit_amount: v })}
        />
      </div>
    </section>
  )
}

function ToggleRow({
  label, description, checked, disabled, onChange,
}: {
  label: string
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text)]">{label}</div>
        <p className="text-xs text-[var(--muted-foreground)] mt-1">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="shrink-0 relative w-11 h-6 rounded-full transition-colors disabled:opacity-50"
        style={{ background: checked ? 'var(--accent)' : 'var(--surface-2)' }}
      >
        <span
          className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
          style={{ left: checked ? '22px' : '2px' }}
        />
      </button>
    </div>
  )
}

function NumberInputWithSave({
  value, disabled, onSave,
}: {
  value: number
  disabled?: boolean
  onSave: (v: number) => void
}) {
  const [draft, setDraft] = useState(String(value))
  const n = Number(draft)
  const dirty = n !== value && Number.isFinite(n) && n > 0

  return (
    <div className="flex gap-2">
      <input
        type="number"
        min={1}
        step={10_000}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={disabled}
        className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        placeholder="100000"
      />
      <button
        type="button"
        disabled={disabled || !dirty}
        onClick={() => onSave(n)}
        className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        저장
      </button>
    </div>
  )
}
