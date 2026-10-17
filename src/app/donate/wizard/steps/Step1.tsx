'use client';
import DonationTypeToggle from '@/components/public/donation/DonationTypeToggle';
import AmountSelector from '@/components/public/donation/AmountSelector';
import DesignationBasket from '@/components/public/donation/DesignationBasket';
import ChildPicker from '@/components/public/donation/ChildPicker';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export function Step1({
  campaignSlug,
  settings,
  state,
  setState,
  onNext,
}: {
  campaignSlug: string;
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

      {state.basket ? (
        <DesignationBasket
          options={settings.designations}
          presets={settings.amountPresets}
          allowCustom={settings.allowCustomAmount}
          value={state.basket}
          onChange={(basket) =>
            setState({ ...state, basket, amount: basket.reduce((sum, l) => sum + l.amount, 0) })
          }
        />
      ) : (
        <>
          <AmountSelector
            presets={settings.amountPresets}
            amountDescriptions={settings.amountDescriptions as Record<string, string> | undefined}
            allowCustom={settings.allowCustomAmount}
            value={state.amount}
            onChange={(a) => setState({ ...state, amount: a ?? 0 })}
          />

          {settings.designations.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--text)]">
                후원 목적
              </label>
              <select
                title="후원 목적 선택"
                value={state.designation ?? ''}
                onChange={(e) => setState({ ...state, designation: e.target.value || undefined })}
                className="w-full rounded px-3 py-2 text-sm bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]"
              >
                <option value="">선택 안 함</option>
                {settings.designations.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {settings.sponsorshipPick && state.type === 'regular' && (
        <ChildPicker
          campaignSlug={campaignSlug}
          value={state.beneficiaryId}
          onChange={(c) => setState({ ...state, beneficiaryId: c?.id })}
        />
      )}

      {/* Sticky CTA is rendered in WizardClient */}
    </div>
  );
}
