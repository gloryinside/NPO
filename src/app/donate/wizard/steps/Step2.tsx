'use client';
import { useState } from 'react';
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';
import { PayMethodSelector } from '@/components/public/donation/PayMethodSelector';
import { AgreementSection } from '@/components/public/donation/AgreementSection';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

declare global {
  interface Window {
    gtag?: (...a: unknown[]) => void;
  }
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs" style={{ color: 'var(--text)' }}>{label}</span>
      <input
        type={type}
        className="w-full rounded px-2 py-1"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; type: string; options?: string[] };
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (field.type === 'textarea')
    return (
      <label className="block">
        <span className="mb-1 block text-xs">{field.label}</span>
        <textarea
          className="w-full rounded px-2 py-1"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  if (field.type === 'checkbox')
    return (
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  if (field.type === 'select')
    return (
      <label className="block">
        <span className="mb-1 block text-xs">{field.label}</span>
        <select
          className="w-full rounded px-2 py-1"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options ?? []).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      </label>
    );
  return (
    <Input label={field.label} value={(value as string) ?? ''} onChange={(v) => onChange(v)} />
  );
}

export function Step2({
  campaign,
  settings,
  state,
  setState,
  onBack,
  onDone,
}: {
  campaign: { id: string; slug: string; title: string };
  settings: FormSettings;
  state: WizardState;
  setState: (s: WizardState) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [info, setInfo] = useState({ name: '', dob: '', mobile: '', email: '', address: '' });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [method, setMethod] = useState(settings.paymentMethods[0] ?? 'card');
  const [receipt, setReceipt] = useState(settings.requireReceipt);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityName, setIdentityName] = useState('');
  const [ag, setAg] = useState({ terms: false, privacy: false, receipt: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!ag.terms || !ag.privacy) return alert('필수 약관에 동의해 주세요.');
    setSubmitting(true);
    window.gtag?.('event', 'add_payment_info', { value: state.amount, currency: 'KRW' });

    const res = await fetch('/api/donations/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        amount: state.amount,
        donationType: state.type,
        designation: state.designation,
        memberName: info.name,
        memberPhone: info.mobile,
        memberEmail: info.email,
        customFields,
        payMethod: method,
        receiptOptIn: receipt,
        identityVerified: receipt ? identityVerified : undefined,
        idempotencyKey: state.idempotencyKey,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert((err as Record<string, string>)?.error ?? '후원 준비 중 오류가 발생했습니다.');
    }

    const data = (await res.json()) as {
      offline?: boolean;
      checkoutUrl?: string;
      paymentCode?: string;
    };

    if (data.offline || !data.checkoutUrl) {
      setState({ ...state, donorInfo: info, paymentMethod: method, customFields, receiptOptIn: receipt, paymentCode: data.paymentCode });
      onDone();
      return;
    }

    window.location.href = data.checkoutUrl;
  }

  // termsBodyHtml is admin-authored HTML passed through sanitizeHtml (DOMPurify) before render.
  const sanitizedTerms = sanitizeHtml(settings.termsBodyHtml);

  return (
    <div className="space-y-4">
      <Input label="이름 *" value={info.name} onChange={(v) => setInfo({ ...info, name: v })} />
      <Input label="생년월일" type="date" value={info.dob} onChange={(v) => setInfo({ ...info, dob: v })} />
      <Input label="휴대폰 *" value={info.mobile} onChange={(v) => setInfo({ ...info, mobile: v })} />
      <Input label="이메일" type="email" value={info.email} onChange={(v) => setInfo({ ...info, email: v })} />
      <Input label="주소" value={info.address} onChange={(v) => setInfo({ ...info, address: v })} />

      {settings.customFields.map((f) => (
        <CustomFieldInput
          key={f.key}
          field={f}
          value={customFields[f.key]}
          onChange={(v) => setCustomFields({ ...customFields, [f.key]: v })}
        />
      ))}

      <PayMethodSelector
        methods={settings.paymentMethods}
        value={method}
        onChange={setMethod}
      />

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
        <input
          type="checkbox"
          checked={receipt}
          onChange={(e) => setReceipt(e.target.checked)}
          disabled={settings.requireReceipt}
          style={{ accentColor: 'var(--accent)' }}
        />
        기부금 영수증 신청
      </label>
      {receipt && !identityVerified && (
        <button
          type="button"
          onClick={async () => {
            const res = await fetch('/api/auth/identity/request', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                successUrl: `${window.location.origin}/donate/wizard?identity=success`,
                failUrl: `${window.location.origin}/donate/wizard?identity=fail`,
              }),
            });
            if (!res.ok) return alert('본인인증 요청 실패');
            const { txId } = await res.json();
            sessionStorage.setItem('identity_txId', txId);
            window.open(
              `https://auth.tosspayments.com/v1/identity-verification/${txId}`,
              '_blank',
              'width=500,height=700',
            );
          }}
          className="w-full rounded-lg py-2.5 text-sm font-semibold"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
        >
          본인인증
        </button>
      )}
      {receipt && identityVerified && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
          style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
        >
          <span>✓</span> 본인인증 완료 ({identityName})
        </div>
      )}

      <AgreementSection
        termsHtml={sanitizedTerms}
        requireReceipt={settings.requireReceipt}
        marketingLabel={settings.marketingOptInLabel}
        value={{
          allChecked:
            ag.terms &&
            ag.privacy &&
            (!settings.requireReceipt || ag.receipt) &&
            (!settings.marketingOptInLabel || ag.marketing),
          terms: ag.terms,
          privacy: ag.privacy,
          receipt: ag.receipt ?? false,
          marketing: ag.marketing,
        }}
        onChange={(v) => setAg({ terms: v.terms, privacy: v.privacy, receipt: v.receipt, marketing: v.marketing })}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded py-3 text-sm"
          style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
        >
          이전
        </button>
        <button
          type="button"
          disabled={submitting || !info.name || !info.mobile}
          onClick={submit}
          className="flex-1 rounded-full py-3 font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)' }}
        >
          {submitting ? '처리 중…' : '후원하기'}
        </button>
      </div>
    </div>
  );
}
