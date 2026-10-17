'use client';
import { useEffect, useState } from 'react';
import { assignVariant, isVisitorId, type ActiveTest, type VariantSettings } from '@/lib/ab/form-test';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import { KioskFinish } from './steps/KioskFinish';
import StepProgressBar from '@/components/public/donation/StepProgressBar';
import StickyCtaButton from '@/components/public/donation/StickyCtaButton';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export type WizardState = {
  type: 'regular' | 'onetime';
  amount: number;
  designation?: string;
  /** 여러 사업 담기 — 있으면 amount 는 이 합계 */
  basket?: { key: string; amount: number }[];
  /** 결연할 아이(정기후원만) */
  beneficiaryId?: string;
  donorInfo?: Record<string, string>;
  paymentMethod?: string;
  customFields?: Record<string, unknown>;
  receiptOptIn?: boolean;
  paymentCode?: string;
  paymentId?: string;
  idempotencyKey: string;
};

/** 담기 모드 첫 화면 — 링크로 목적이 왔으면 그 사업, 아니면 첫 사업을 담아 둔다 */
function prefillBasket(settings: FormSettings, prefill: { amount?: number; designation?: string }) {
  const first = settings.designations.find((d) => d.key === prefill.designation) ?? settings.designations[0]!;
  return [{ key: first.key, amount: prefill.amount ?? settings.amountPresets[0] ?? 10000 }];
}

/** 브라우저마다 고정된 임의 id — A/B 배정용. 저장이 막혀 있으면 이번 화면에서만 쓴다 */
function visitorId(): string {
  const KEY = 'npo_ab_vid';
  try {
    const v = localStorage.getItem(KEY);
    if (v && isVisitorId(v)) return v;
    const n = crypto.randomUUID();
    localStorage.setItem(KEY, n);
    return n;
  } catch {
    return crypto.randomUUID();
  }
}

type WizardProps = {
  campaign: { id: string; slug: string; title: string; orgId: string };
  settings: FormSettings;
  isLoggedIn: boolean;
  prefill: { type?: string; amount?: number; designation?: string; completed?: boolean };
  /** 현장 모금(태블릿) — 모금가 링크로 연 화면 */
  kiosk?: { token: string; agentName: string };
  /** 진행 중인 신청 화면 A/B 비교 */
  abTest?: ActiveTest | null;
};

/**
 * 신청 화면. A/B 비교 중이면 방문자 안(A/B)을 브라우저에서 정한 뒤 그 안의 금액 버튼으로 연다
 * (서버 렌더와 어긋나지 않게 배정 전에는 잠깐 비워 둔다).
 */
export function WizardClient({ abTest, ...props }: WizardProps) {
  const [ab, setAb] = useState<{ testId: string; visitorId: string; variant: VariantSettings } | null | undefined>(
    abTest ? undefined : null,
  );
  useEffect(() => {
    if (!abTest) return;
    const vid = visitorId();
    const key = assignVariant(abTest.id, vid);
    const variant = abTest.variants.find((v) => v.key === key);
    setAb(variant ? { testId: abTest.id, visitorId: vid, variant } : null);
    void fetch('/api/public/ab/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ testId: abTest.id, visitorId: vid }),
    }).catch(() => {});
  }, [abTest]);

  if (ab === undefined) {
    return <main className="mx-auto max-w-xl px-4 py-8" aria-busy="true" />;
  }
  if (!ab) return <WizardInner {...props} />;

  const v = ab.variant;
  const settings: FormSettings = {
    ...props.settings,
    ...(v.amountPresets.length > 0 ? { amountPresets: v.amountPresets } : {}),
  };
  const type = props.prefill.type ?? (v.defaultType && settings.donationTypes.includes(v.defaultType) ? v.defaultType : undefined);
  return (
    <WizardInner
      {...props}
      settings={settings}
      prefill={{ ...props.prefill, type }}
      abTag={{ testId: ab.testId, visitorId: ab.visitorId }}
    />
  );
}

function WizardInner({
  campaign,
  settings,
  isLoggedIn,
  prefill,
  kiosk,
  abTag,
}: Omit<WizardProps, 'abTest'> & { abTag?: { testId: string; visitorId: string } }) {
  const [step, setStep] = useState<1 | 2 | 3>(prefill.completed ? 3 : 1);
  const [state, setState] = useState<WizardState>({
    type: (prefill.type as 'regular' | 'onetime') ?? settings.donationTypes[0] ?? 'onetime',
    amount: settings.designationMode === 'basket' && settings.designations.length > 0
      ? prefillBasket(settings, prefill)[0]!.amount
      : prefill.amount ?? settings.amountPresets[0] ?? 10000,
    designation: prefill.designation,
    basket: settings.designationMode === 'basket' && settings.designations.length > 0
      ? prefillBasket(settings, prefill)
      : undefined,
    idempotencyKey: crypto.randomUUID(),
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      {kiosk && (
        <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">현장 신청 · 모금가 {kiosk.agentName}</p>
      )}
      <h1 className="mb-6 text-xl font-bold text-[var(--text)]">{campaign.title}</h1>

      <StepProgressBar
        steps={['후원 선택', '정보 입력', '결제 완료']}
        currentStep={step - 1}
      />

      {step === 1 && (
        <Step1
          campaignSlug={campaign.slug}
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
          f2fToken={kiosk?.token}
          abTag={abTag}
        />
      )}
      {step === 3 && (kiosk ? (
        <KioskFinish token={kiosk.token} state={state} />
      ) : (
        <Step3 campaign={campaign} settings={settings} state={state} isLoggedIn={isLoggedIn} />
      ))}

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
