'use client';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function FormSettingsPanel({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: any;
}) {
  const [s, setS] = useState<any>({
    amountPresets: [],
    allowCustomAmount: false,
    donationTypes: [],
    paymentMethods: [],
    requireReceipt: false,
    termsBodyHtml: '',
    designations: [],
    customFields: [],
    ...initial,
  });
  const [saving, setSaving] = useState(false);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/form-settings`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(s),
    });
    setSaving(false);
    if (res.ok) toast.success('저장됐습니다');
    else toast.error('저장 실패');
  }

  return (
    <div className="space-y-3 p-3 text-sm">
      {/* Amount presets */}
      <div>
        <div className="mb-1 text-xs text-neutral-600">금액 프리셋 (쉼표 구분)</div>
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          value={s.amountPresets.join(',')}
          onChange={(e) =>
            setS({
              ...s,
              amountPresets: e.target.value
                .split(',')
                .map((x: string) => Number(x.trim()))
                .filter((n: number) => n > 0),
            })
          }
        />
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.allowCustomAmount}
          onChange={(e) => setS({ ...s, allowCustomAmount: e.target.checked })}
        />
        직접입력 허용
      </label>

      {/* Donation types */}
      <div>
        <div className="mb-1 text-xs text-neutral-600">후원 유형</div>
        {['regular', 'onetime'].map((t) => (
          <label key={t} className="mr-3 inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={s.donationTypes.includes(t)}
              onChange={() => setS({ ...s, donationTypes: toggle(s.donationTypes, t) })}
            />
            {t === 'regular' ? '정기' : '일시'}
          </label>
        ))}
      </div>

      {/* Payment methods */}
      <div>
        <div className="mb-1 text-xs text-neutral-600">결제수단</div>
        {['card', 'cms', 'naverpay', 'kakaopay', 'payco', 'virtual'].map((m) => (
          <label key={m} className="mr-2 inline-flex items-center gap-1">
            <input
              type="checkbox"
              checked={s.paymentMethods.includes(m)}
              onChange={() => setS({ ...s, paymentMethods: toggle(s.paymentMethods, m) })}
            />
            {m}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={s.requireReceipt}
          onChange={(e) => setS({ ...s, requireReceipt: e.target.checked })}
        />
        영수증 필수
      </label>

      {/* Terms */}
      <div>
        <div className="mb-1 text-xs text-neutral-600">약관 본문 (HTML)</div>
        <textarea
          className="h-24 w-full rounded border p-1 text-xs"
          value={s.termsBodyHtml}
          onChange={(e) => setS({ ...s, termsBodyHtml: e.target.value })}
        />
      </div>

      <DesignationsEditor
        value={s.designations}
        onChange={(d: any) => setS({ ...s, designations: d })}
        mode={s.designationMode ?? 'single'}
        onModeChange={(m) => setS({ ...s, designationMode: m })}
      />
      <SponsorshipPickEditor
        enabled={!!s.sponsorshipPick}
        programId={s.sponsorshipProgramId ?? null}
        onChange={(enabled, programId) => setS({ ...s, sponsorshipPick: enabled, sponsorshipProgramId: programId })}
      />
      <CustomFieldsEditor
        value={s.customFields}
        onChange={(f: any) => setS({ ...s, customFields: f })}
      />

      <button
        disabled={saving}
        onClick={save}
        className="w-full rounded bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? '저장 중…' : '폼 설정 저장'}
      </button>
    </div>
  );
}

type ProgramOption = { id: string; name: string };

/** 올해 진행 중인 회계 사업 */
function useActivePrograms(): ProgramOption[] {
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  useEffect(() => {
    fetch(`/api/admin/programs?year=${new Date().getFullYear()}&status=active`)
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d: { items?: ProgramOption[] }) => setPrograms(d.items ?? []))
      .catch(() => setPrograms([]));
  }, []);
  return programs;
}

function DesignationsEditor({
  value,
  onChange,
  mode,
  onModeChange,
}: {
  value: any[];
  onChange: (v: any[]) => void;
  mode: 'single' | 'basket';
  onModeChange: (m: 'single' | 'basket') => void;
}) {
  // 회계 사업 — 연결하면 이 목적으로 들어온 돈이 그 사업 수입으로 자동 배분된다
  const programs = useActivePrograms();
  const update = (i: number, patch: Record<string, unknown>) => {
    const n = [...value];
    n[i] = { ...n[i], ...patch };
    onChange(n);
  };

  return (
    <div>
      <div className="mb-1 text-xs text-neutral-600">후원 목적</div>
      <div className="mb-2 flex gap-3 text-xs" role="radiogroup" aria-label="후원 목적 고르는 방식">
        <label className="inline-flex items-center gap-1">
          <input type="radio" name="designation-mode" checked={mode === 'single'} onChange={() => onModeChange('single')} />
          하나 고르기
        </label>
        <label className="inline-flex items-center gap-1">
          <input type="radio" name="designation-mode" checked={mode === 'basket'} onChange={() => onModeChange('basket')} />
          여러 사업 담기
        </label>
      </div>
      {mode === 'basket' && (
        <p className="mb-2 text-[11px] text-neutral-500">후원자가 사업을 여러 개 담고 사업마다 금액을 고릅니다. 금액 버튼은 위 금액 프리셋을 씁니다.</p>
      )}
      {value.map((d: any, i: number) => (
        <div key={i} className="mb-2 space-y-1 rounded border p-1.5">
          <div className="flex gap-1">
            <input
              className="w-24 rounded border px-1 text-xs"
              placeholder="key"
              aria-label="목적 키"
              value={d.key}
              onChange={(e) => update(i, { key: e.target.value })}
            />
            <input
              className="flex-1 rounded border px-1 text-xs"
              placeholder="이름 (예: 아동 교육)"
              aria-label="목적 이름"
              value={d.label}
              onChange={(e) => update(i, { label: e.target.value })}
            />
            <button
              onClick={() => onChange(value.filter((_: any, j: number) => j !== i))}
              className="text-rose-500"
              aria-label={`${d.label || '목적'} 삭제`}
            >
              ×
            </button>
          </div>
          <input
            className="w-full rounded border px-1 text-xs"
            placeholder="한 줄 설명 (선택)"
            aria-label="한 줄 설명"
            maxLength={120}
            value={d.description ?? ''}
            onChange={(e) => update(i, { description: e.target.value || undefined })}
          />
          <select
            className="w-full rounded border px-1 text-xs"
            aria-label="연결할 회계 사업"
            value={d.programId ?? ''}
            onChange={(e) => update(i, { programId: e.target.value || null })}
          >
            <option value="">회계 사업 연결 안 함</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {d.programId && !programs.some((p) => p.id === d.programId) && (
              <option value={d.programId}>(올해 진행 중이 아닌 사업)</option>
            )}
          </select>
        </div>
      ))}
      <button
        onClick={() => onChange([...value, { key: '', label: '' }])}
        className="rounded border px-2 text-xs hover:bg-neutral-50"
      >
        + 추가
      </button>
    </div>
  );
}

function SponsorshipPickEditor({
  enabled,
  programId,
  onChange,
}: {
  enabled: boolean;
  programId: string | null;
  onChange: (enabled: boolean, programId: string | null) => void;
}) {
  const programs = useActivePrograms();
  return (
    <div>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={enabled} onChange={(e) => onChange(e.target.checked, programId)} />
        정기후원 신청 때 결연 아동 고르기
      </label>
      {enabled && (
        <>
          <p className="mt-1 text-[11px] text-neutral-500">수혜자 화면에서 &lsquo;신청 화면에 공개&rsquo;를 켠 아이만 보입니다.</p>
          <select
            className="mt-1 w-full rounded border px-1 text-xs"
            aria-label="고를 수 있는 아이의 사업"
            value={programId ?? ''}
            onChange={(e) => onChange(true, e.target.value || null)}
          >
            <option value="">모든 사업의 아이</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>{p.name} 소속만</option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}

function CustomFieldsEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs text-neutral-600">커스텀 필드</div>
      {value.map((f: any, i: number) => (
        <div key={i} className="mb-1 flex flex-wrap gap-1">
          <input
            className="w-20 rounded border px-1 text-xs"
            placeholder="key"
            value={f.key}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }}
          />
          <input
            className="flex-1 rounded border px-1 text-xs"
            placeholder="label"
            value={f.label}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }}
          />
          <select
            className="rounded border text-xs"
            value={f.type}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], type: e.target.value }; onChange(n); }}
          >
            <option value="text">text</option>
            <option value="textarea">textarea</option>
            <option value="select">select</option>
            <option value="checkbox">checkbox</option>
          </select>
          <label className="inline-flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={f.required}
              onChange={(e) => { const n = [...value]; n[i] = { ...n[i], required: e.target.checked }; onChange(n); }}
            />
            필수
          </label>
          <button
            onClick={() => onChange(value.filter((_: any, j: number) => j !== i))}
            className="text-rose-500"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={() => onChange([...value, { key: '', label: '', type: 'text', required: false }])}
        className="rounded border px-2 text-xs hover:bg-neutral-50"
      >
        + 추가
      </button>
    </div>
  );
}
