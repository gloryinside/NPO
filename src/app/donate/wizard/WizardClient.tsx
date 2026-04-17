'use client';
import { useState } from 'react';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import { StepProgressBar } from '@/components/public/donation/StepProgressBar';
import { StickyCtaButton } from '@/components/public/donation/StickyCtaButton';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export type WizardState = {
  type: 'regular' | 'onetime';
  amount: number;
  designation?: string;
  donorInfo?: Record<string, string>;
  paymentMethod?: string;
  customFields?: Record<string, unknown>;
  receiptOptIn?: boolean;
  paymentCode?: string;
  idempotencyKey: string;
};

export function WizardClient({
  campaign,
  settings,
  prefill,
}: {
  campaign: { id: string; slug: string; title: string; orgId: string };
  settings: FormSettings;
  prefill: { type?: string; amount?: number; designation?: string; completed?: boolean };
}) {
  const [step, setStep] = useState<1 | 2 | 3>(prefill.completed ? 3 : 1);
  const [state, setState] = useState<WizardState>({
    type: (prefill.type as 'regular' | 'onetime') ?? settings.donationTypes[0] ?? 'onetime',
    amount: prefill.amount ?? settings.amountPresets[0] ?? 10000,
    designation: prefill.designation,
    idempotencyKey: crypto.randomUUID(),
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-6 text-xl font-bold" style={{ color: 'var(--text)' }}>{campaign.title}</h1>

      <StepProgressBar
        steps={['후원 선택', '정보 입력', '결제 완료']}
        currentStep={step - 1}
      />

      {step === 1 && (
        <Step1
          settings={settings}
          state={state}
          setState={setState}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          campaign={campaign}
          settings={settings}
          state={state}
          setState={setState}
          onBack={() => setStep(1)}
          onDone={() => setStep(3)}
        />
      )}
      {step === 3 && <Step3 campaign={campaign} settings={settings} state={state} />}

      {step === 1 && (
        <StickyCtaButton
          label="다음"
          onClick={() => setStep(2)}
          disabled={state.amount <= 0}
          loading={false}
        />
      )}
    </main>
  );
}
