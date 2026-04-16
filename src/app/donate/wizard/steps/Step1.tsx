'use client';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export function Step1({
  settings,
  state,
  setState,
  onNext,
}: {
  settings: FormSettings;
  state: WizardState;
  setState: (s: WizardState) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Donation type */}
      {settings.donationTypes.length > 1 && (
        <div className="flex gap-2">
          {settings.donationTypes.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => setState({ ...state, type: t })}
              className={`flex-1 rounded-full px-4 py-2 ${state.type === t ? 'bg-rose-500 text-white' : 'bg-neutral-100'}`}
            >
              {t === 'regular' ? '정기' : '일시'}
            </button>
          ))}
        </div>
      )}

      {/* Amount presets */}
      <div className="grid grid-cols-2 gap-2">
        {settings.amountPresets.map((a) => (
          <button
            type="button"
            key={a}
            onClick={() => setState({ ...state, amount: a })}
            className={`rounded border px-3 py-2 text-sm ${state.amount === a ? 'border-rose-500 bg-rose-50 font-semibold' : ''}`}
          >
            {a.toLocaleString()}원
          </button>
        ))}
      </div>

      {/* Custom amount */}
      {settings.allowCustomAmount && (
        <div>
          <label className="mb-1 block text-xs text-neutral-600">직접 입력</label>
          <input
            type="number"
            min={0}
            value={state.amount}
            onChange={(e) => setState({ ...state, amount: Number(e.target.value) })}
            className="w-full rounded border px-3 py-2"
          />
        </div>
      )}

      {/* Designation */}
      {settings.designations.length > 0 && (
        <div>
          <label className="mb-1 block text-xs text-neutral-600">후원 목적</label>
          <select
            value={state.designation ?? ''}
            onChange={(e) => setState({ ...state, designation: e.target.value || undefined })}
            className="w-full rounded border px-3 py-2"
          >
            <option value="">선택 안 함</option>
            {settings.designations.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="button"
        disabled={state.amount <= 0}
        onClick={onNext}
        className="w-full rounded-full bg-rose-500 py-3 font-semibold text-white disabled:opacity-50"
      >
        다음
      </button>
    </div>
  );
}
