'use client';
import { DonationTypeToggle } from '@/components/public/donation/DonationTypeToggle';
import { AmountSelector } from '@/components/public/donation/AmountSelector';
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
    <div className="space-y-6">
      <DonationTypeToggle
        value={state.type}
        available={settings.donationTypes as ('onetime' | 'regular')[]}
        onChange={(t) => setState({ ...state, type: t })}
      />

      <AmountSelector
        presets={settings.amountPresets}
        amountDescriptions={settings.amountDescriptions}
        allowCustom={settings.allowCustomAmount}
        value={state.amount}
        onChange={(a) => setState({ ...state, amount: a ?? 0 })}
      />

      {settings.designations.length > 0 && (
        <div>
          <label className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
            후원 목적
          </label>
          <select
            value={state.designation ?? ''}
            onChange={(e) => setState({ ...state, designation: e.target.value || undefined })}
            className="w-full rounded px-3 py-2 text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            <option value="">선택 안 함</option>
            {settings.designations.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Sticky CTA is rendered in WizardClient */}
    </div>
  );
}
