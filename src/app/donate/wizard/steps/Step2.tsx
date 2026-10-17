'use client';
import { useState, useEffect } from 'react';
import { loadTossPayments } from '@tosspayments/payment-sdk';
import { toast } from 'sonner';
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';
import PayMethodSelector from '@/components/public/donation/PayMethodSelector';
import AgreementSection from '@/components/public/donation/AgreementSection';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

// 위저드 결제 플로우:
// - offline (transfer/cms/manual): prepare 응답만으로 완료 → Step3
// - regular + card: prepare 내부에서 billingKey 발급 → Step3 (즉시 청구 아님, 다음 pay_day부터)
// - onetime + online (card/kakaopay/naverpay/payco/virtual): Toss SDK requestPayment 호출 → /donate/success
// Toss 메서드 이름 매핑은 Toss v1 SDK 규약 따름.
// Toss payment-sdk v1 타입이 허용하는 PaymentMethodType만 매핑한다.
// 카카오페이/네이버페이/페이코 등 간편결제는 "카드" 위젯 내부 옵션 또는
// 별도 appScheme/easyPay 플로우가 필요하므로 Phase 3에서 별도 처리.
const TOSS_METHOD_MAP = {
  card: '카드',
  virtual: '가상계좌',
} as const;

type TossMethodKey = keyof typeof TOSS_METHOD_MAP;

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
      <span className="mb-1 block text-xs text-[var(--text)]">{label}</span>
      <input
        type={type}
        className="w-full rounded px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]"
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
          className="w-full rounded px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]"
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
          title={field.label}
          className="w-full rounded px-2 py-1 bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)]"
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
  const [method, setMethod] = useState<string>(settings.paymentMethods[0] ?? 'card');
  const [receipt, setReceipt] = useState(settings.requireReceipt);
  const [identityVerified, setIdentityVerified] = useState(false);
  const [identityName, setIdentityName] = useState('');
  const [ag, setAg] = useState({ terms: false, privacy: false, receipt: false, marketing: false });
  // 연말정산 간소화 반영용 주민등록번호 — 영수증 신청 시에만, 별도 동의 필수
  const [rrn, setRrn] = useState('');
  const [rrnConsent, setRrnConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('identity') === 'success') {
      const txId = params.get('txId') ?? sessionStorage.getItem('identity_txId');
      if (txId) {
        fetch('/api/auth/identity/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ txId, memberId: state.donorInfo?.memberId }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.ok) {
              setIdentityVerified(true);
              setIdentityName(data.name ?? '');
              if (data.name) setInfo((prev) => ({ ...prev, name: data.name }));
              if (data.birthday) setInfo((prev) => ({ ...prev, dob: data.birthday }));
              sessionStorage.removeItem('identity_txId');
              const url = new URL(window.location.href);
              url.searchParams.delete('identity');
              url.searchParams.delete('txId');
              window.history.replaceState({}, '', url.toString());
            }
          });
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (!ag.terms || !ag.privacy) return void toast.error('필수 약관에 동의해 주세요.');
    const rrnDigits = rrn.replace(/\D/g, '');
    if (receipt && rrnDigits) {
      if (rrnDigits.length !== 13) return void toast.error('주민등록번호 13자리를 확인해 주세요.');
      if (!rrnConsent) return void toast.error('주민등록번호 수집·이용(고유식별정보 처리)에 동의해 주세요.');
    }
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
        ...(receipt && rrnDigits ? { residentNo: rrnDigits, rrnConsent } : {}),
        idempotencyKey: state.idempotencyKey,
        // 카드 정기후원은 카드번호를 보내지 않는다 — 토스 결제창(requestBillingAuth)에서 등록
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return void toast.error((err as Record<string, string>)?.error ?? '후원 준비 중 오류가 발생했습니다.');
    }

    const data = (await res.json()) as {
      offline?: boolean;
      orderId?: string;
      paymentCode?: string;
      amount?: number;
      orderName?: string;
      tossClientKey?: string;
      billingKeyFailed?: boolean;
      billingAuth?: { customerKey: string; promiseId: string };
    };

    // 오프라인 결제(transfer/cms/manual) — 계좌 안내 후 Step3로 이동
    if (data.offline) {
      setState({ ...state, donorInfo: info, paymentMethod: method, customFields, receiptOptIn: receipt, paymentCode: data.paymentCode });
      onDone();
      return;
    }

    // 카드 정기후원 — 토스 결제창에서 카드 등록(본인인증 포함). 완료되면 /donate/billing/success로 돌아와
    // 서버가 authKey로 빌링키를 발급한다. 카드 정보는 우리 서버를 거치지 않는다.
    if (state.type === 'regular' && data.billingAuth && data.tossClientKey) {
      try {
        const tossPayments = await loadTossPayments(data.tossClientKey);
        const back = new URL('/donate/billing/success', window.location.origin);
        back.searchParams.set('promiseId', data.billingAuth.promiseId);
        await tossPayments.requestBillingAuth('카드', {
          customerKey: data.billingAuth.customerKey,
          customerName: info.name.trim(),
          customerEmail: info.email.trim() || undefined,
          successUrl: back.toString(),
          failUrl: `${window.location.origin}/donate/billing/fail`,
        });
      } catch (err) {
        // 사용자가 결제창을 닫으면 여기로 — 약정은 카드 등록 대기로 남아 나중에 등록 가능
        const msg = err instanceof Error ? err.message : '카드 등록 중 오류가 발생했습니다.';
        toast.error(msg);
      }
      return;
    }

    // 정기 후원(오프라인·키인 하위 호환) — 즉시 Toss 결제 없음
    if (state.type === 'regular') {
      if (data.billingKeyFailed) {
        toast.error('카드 등록에 실패했습니다.', { description: '카드 정보를 확인한 뒤 다시 시도해 주세요.' });
        return;
      }
      setState({ ...state, donorInfo: info, paymentMethod: method, customFields, receiptOptIn: receipt, paymentCode: data.paymentCode });
      onDone();
      return;
    }

    // 일시 후원 + 온라인 결제수단 — Toss SDK 호출
    if (!data.tossClientKey || !data.orderId || !data.amount) {
      toast.error('결제 준비 응답이 올바르지 않습니다.');
      return;
    }

    if (!(method in TOSS_METHOD_MAP)) {
      toast.error('지원하지 않는 결제수단입니다.');
      return;
    }
    const tossMethod = TOSS_METHOD_MAP[method as TossMethodKey];

    try {
      const tossPayments = await loadTossPayments(data.tossClientKey);
      await tossPayments.requestPayment(tossMethod, {
        amount: data.amount,
        orderId: data.orderId,
        orderName: data.orderName ?? campaign.title,
        customerName: info.name.trim(),
        customerEmail: info.email.trim() || undefined,
        successUrl: `${window.location.origin}/donate/success`,
        failUrl: `${window.location.origin}/donate/fail`,
      });
      // requestPayment는 페이지 리디렉션을 유발하므로 여기 이후 코드는 일반적으로 실행되지 않음.
      // 사용자가 취소한 경우 Toss SDK가 promise reject하며 catch 블록으로 진입.
    } catch (err) {
      const msg = err instanceof Error ? err.message : '결제 진행 중 오류가 발생했습니다.';
      toast.error(msg);
    }
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
        disabledMethods={
          state.type === 'onetime'
            ? settings.paymentMethods.filter((m) => {
                const s = m as string
                return !(s in TOSS_METHOD_MAP) && s !== 'transfer' && s !== 'cms'
              })
            : []
        }
      />

      {state.type === 'regular' && method === 'card' && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-xs text-[var(--muted-foreground)]">
          <p className="mb-1 font-semibold text-[var(--text)]">정기결제 카드 등록</p>
          다음 단계에서 <b>토스페이먼츠 결제창</b>이 열립니다. 카드 정보와 본인인증은 결제창에서 입력하며,
          우리 기관 서버에는 카드번호가 저장되지 않습니다.
        </div>
      )}

      {/* G-D86: 영수증 발급 안내 — 공제 유형·발급 시점·연말정산 연동 */}
      <div className="rounded-lg border bg-[var(--surface-2)] border-[var(--border)] p-3 text-xs text-[var(--muted-foreground)] leading-relaxed">
        <p className="font-medium text-[var(--text)] mb-1">
          🧾 기부금 영수증 안내
        </p>
        <ul className="space-y-0.5 list-disc pl-4">
          <li>연말정산 시 <b>기부금 세액공제</b> 대상 (공제율은 기관 인증에 따름)</li>
          <li>발급 시점: 매년 1월 국세청 연말정산 간소화 자료 일괄 제출</li>
          <li>등록한 이메일로도 PDF 사본 발송</li>
          <li>영수증 발급을 원하시면 <b>본인인증</b>이 필요합니다</li>
        </ul>
      </div>

      <label className="flex items-center gap-2 text-sm text-[var(--text)]">
        <input
          type="checkbox"
          checked={receipt}
          onChange={(e) => setReceipt(e.target.checked)}
          disabled={settings.requireReceipt}
          className="accent-[var(--accent)]"
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
            if (!res.ok) return void toast.error('본인인증 요청 실패');
            const { txId, authUrl } = await res.json();
            sessionStorage.setItem('identity_txId', txId);
            window.open(authUrl, '_blank', 'width=500,height=700');
          }}
          className="w-full rounded-lg py-2.5 text-sm font-semibold bg-[var(--surface-2)] border border-[var(--accent)] text-[var(--accent)]"
        >
          본인인증
        </button>
      )}
      {receipt && identityVerified && (
        <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-[var(--accent-soft)] text-[var(--accent)]">
          <span>✓</span> 본인인증 완료 ({identityName})
        </div>
      )}
      {receipt && (
        <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <Input
            label="주민등록번호 (연말정산 간소화 반영용, 선택)"
            value={rrn}
            type="password"
            onChange={(v) => setRrn(v.replace(/[^0-9-]/g, '').slice(0, 14))}
          />
          <label className="flex items-start gap-2 text-xs text-[var(--text)]">
            <input
              type="checkbox"
              checked={rrnConsent}
              onChange={(e) => setRrnConsent(e.target.checked)}
              className="mt-0.5 accent-[var(--accent)]"
            />
            <span>
              <b>[필수·주민등록번호 입력 시] 고유식별정보 수집·이용 동의</b>
              <br />
              목적: 기부금영수증 발급 및 국세청 연말정산 간소화 자료 제출 · 항목: 주민등록번호 ·
              보유기간: 기부금영수증 발급일로부터 5년(세법상 보관 의무) · 동의하지 않으실 수 있으며,
              이 경우 영수증은 발급되지만 연말정산 간소화에는 자동 반영되지 않습니다.
            </span>
          </label>
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
        onChange={(v: { terms: boolean; privacy: boolean; receipt: boolean; marketing: boolean }) => setAg({ terms: v.terms, privacy: v.privacy, receipt: v.receipt, marketing: v.marketing })}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded py-3 text-sm border border-[var(--border)] text-[var(--muted-foreground)]"
        >
          이전
        </button>
        <button
          type="button"
          disabled={submitting || !info.name || !info.mobile}
          onClick={submit}
          className="flex-1 rounded-full py-3 font-semibold text-white bg-[var(--accent)] disabled:opacity-50"
        >
          {submitting ? '처리 중…' : '후원하기'}
        </button>
      </div>
    </div>
  );
}
