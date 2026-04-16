'use client';
import { useState } from 'react';
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';
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
      <span className="mb-1 block text-xs text-neutral-600">{label}</span>
      <input
        type={type}
        className="w-full rounded border px-2 py-1"
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
          className="w-full rounded border px-2 py-1"
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
          className="w-full rounded border px-2 py-1"
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
  const [residentNo, setResidentNo] = useState('');
  const [ag, setAg] = useState({ terms: false, privacy: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!ag.terms || !ag.privacy) return alert('필수 약관에 동의해 주세요.');
    setSubmitting(true);
    setState({ ...state, donorInfo: info, paymentMethod: method, customFields, receiptOptIn: receipt });
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
        residentNo: receipt ? residentNo : undefined,
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
    };

    if (data.offline || !data.checkoutUrl) {
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

      <div>
        <div className="mb-1 text-xs text-neutral-600">결제수단</div>
        {settings.paymentMethods.map((m) => (
          <label key={m} className="mr-3 inline-flex items-center gap-1 text-sm">
            <input type="radio" checked={method === m} onChange={() => setMethod(m)} />
            {m}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={receipt}
          onChange={(e) => setReceipt(e.target.checked)}
          disabled={settings.requireReceipt}
        />
        기부금 영수증 신청
      </label>
      {receipt && (
        <Input label="주민번호 / 사업자번호" value={residentNo} onChange={setResidentNo} />
      )}

      {sanitizedTerms && (
        <div
          className="max-h-32 overflow-auto rounded border p-3 text-xs text-neutral-600"
          /* sanitizeHtml (DOMPurify) is applied on the line above — safe to render */
          dangerouslySetInnerHTML={{ __html: sanitizedTerms }}
        />
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ag.terms} onChange={(e) => setAg({ ...ag, terms: e.target.checked })} />
        [필수] 이용약관 동의
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={ag.privacy} onChange={(e) => setAg({ ...ag, privacy: e.target.checked })} />
        [필수] 개인정보 수집·이용 동의
      </label>
      {settings.marketingOptInLabel && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ag.marketing}
            onChange={(e) => setAg({ ...ag, marketing: e.target.checked })}
          />
          [선택] {settings.marketingOptInLabel}
        </label>
      )}

      <div className="flex gap-2">
        <button type="button" onClick={onBack} className="flex-1 rounded border py-3 text-sm">
          이전
        </button>
        <button
          type="button"
          disabled={submitting || !info.name || !info.mobile}
          onClick={submit}
          className="flex-1 rounded-full bg-rose-500 py-3 font-semibold text-white disabled:opacity-50"
        >
          {submitting ? '처리 중…' : '후원하기'}
        </button>
      </div>
    </div>
  );
}
