'use client';
import { useState } from 'react';

export function FormSettingsPanel({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: any;
}) {
  const [s, setS] = useState<any>(initial);
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
    alert(res.ok ? '저장됐습니다' : '저장 실패');
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

function DesignationsEditor({ value, onChange }: { value: any[]; onChange: (v: any[]) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs text-neutral-600">후원 목적</div>
      {value.map((d: any, i: number) => (
        <div key={i} className="mb-1 flex gap-1">
          <input
            className="w-24 rounded border px-1 text-xs"
            placeholder="key"
            value={d.key}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }}
          />
          <input
            className="flex-1 rounded border px-1 text-xs"
            placeholder="label"
            value={d.label}
            onChange={(e) => { const n = [...value]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }}
          />
          <button
            onClick={() => onChange(value.filter((_: any, j: number) => j !== i))}
            className="text-rose-500"
          >
            ×
          </button>
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
