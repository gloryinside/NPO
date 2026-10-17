'use client';

import { MARKETING_NOTICE, PRIVACY_NOTICE } from '@/lib/legal/consent';

interface AgreementValue {
  allChecked: boolean;
  terms: boolean;
  privacy: boolean;
  over14: boolean;
  receipt: boolean;
  marketing: boolean;
}

interface AgreementSectionProps {
  termsHtml: string;
  requireReceipt: boolean;
  marketingLabel?: string;
  value: AgreementValue;
  onChange: (v: AgreementValue) => void;
}

type Key = keyof Omit<AgreementValue, 'allChecked'>;

/** 고지 4가지(목적·항목·보유기간·거부할 권리) — 개인정보 보호법 제15조제2항 */
function NoticeTable({ notice }: { notice: { purpose: string; items: string; retention: string; refusal: string } }) {
  const rows: [string, string][] = [
    ['수집·이용 목적', notice.purpose],
    ['수집 항목', notice.items],
    ['보유·이용 기간', notice.retention],
    ['동의 거부 권리', notice.refusal],
  ];
  return (
    <dl className="mt-2 grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 rounded-lg bg-[var(--surface)] p-3 text-xs text-[var(--muted-foreground)]">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="font-medium text-[var(--text)]">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * 후원 신청 동의.
 *  - 필수: 이용약관, 개인정보 수집·이용, 만 14세 이상 (+ 기관이 정한 경우 영수증 발급)
 *  - 선택: 마케팅 수신 — 동의하지 않아도 신청할 수 있다
 *  내용은 '보기'로 펼쳐 읽을 수 있다. 위탁·국외 이전은 처리방침에 안내한다.
 */
export default function AgreementSection({ termsHtml, requireReceipt, marketingLabel, value, onChange }: AgreementSectionProps) {
  const computeAllChecked = (v: Omit<AgreementValue, 'allChecked'>): boolean => {
    if (!v.terms || !v.privacy || !v.over14) return false;
    if (requireReceipt && !v.receipt) return false;
    if (marketingLabel && !v.marketing) return false;
    return true;
  };

  const handleAll = (checked: boolean) => {
    onChange({ allChecked: checked, terms: checked, privacy: checked, over14: checked, receipt: checked, marketing: checked });
  };

  const handleItem = (key: Key, checked: boolean) => {
    const next = { ...value, [key]: checked };
    onChange({ ...next, allChecked: computeAllChecked(next) });
  };

  const checkboxStyle: React.CSSProperties = { accentColor: 'var(--accent)', width: '18px', height: '18px', flexShrink: 0, cursor: 'pointer' };

  const items: { key: Key; label: string; show: boolean; detail?: React.ReactNode }[] = [
    {
      key: 'terms',
      label: '후원 이용약관 동의 (필수)',
      show: true,
      detail: termsHtml ? (
        // 기관이 입력한 약관 — 상위에서 sanitizeHtml 을 거친 값
        <div className="prose-legal mt-2 max-h-48 overflow-y-auto rounded-lg bg-[var(--surface)] p-3 text-xs" dangerouslySetInnerHTML={{ __html: termsHtml }} />
      ) : (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          <a href="/terms" target="_blank" rel="noopener" className="underline">이용약관 전문 보기</a>
        </p>
      ),
    },
    {
      key: 'privacy',
      label: '개인정보 수집·이용 동의 (필수)',
      show: true,
      detail: (
        <>
          <NoticeTable notice={PRIVACY_NOTICE} />
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            결제·메일 발송 등 처리 위탁과 국외 보관은{' '}
            <a href="/privacy" target="_blank" rel="noopener" className="underline">개인정보 처리방침</a>에서 안내합니다.
          </p>
        </>
      ),
    },
    { key: 'over14', label: '만 14세 이상입니다 (필수)', show: true },
    { key: 'receipt', label: '기부금 영수증 발급 동의 (필수)', show: requireReceipt },
    {
      key: 'marketing',
      label: `${marketingLabel ?? ''} (선택)`,
      show: !!marketingLabel,
      detail: <NoticeTable notice={MARKETING_NOTICE} />,
    },
  ];

  return (
    <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }} className="rounded-xl p-4 flex flex-col gap-3">
      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" style={checkboxStyle} checked={value.allChecked} onChange={(e) => handleAll(e.target.checked)} />
        <span className="font-bold text-sm">전체 동의 <span className="font-normal text-[var(--muted-foreground)]">(선택 항목 포함)</span></span>
      </label>

      <hr style={{ borderColor: 'var(--border)' }} />

      {items
        .filter((item) => item.show)
        .map((item) => (
          <div key={item.key}>
            <label className="flex items-center gap-3 cursor-pointer">
              <input type="checkbox" style={checkboxStyle} checked={value[item.key]} onChange={(e) => handleItem(item.key, e.target.checked)} />
              <span className="text-sm">{item.label}</span>
            </label>
            {item.detail && (
              <details className="ml-[30px]">
                <summary className="cursor-pointer text-xs text-[var(--muted-foreground)]">내용 보기</summary>
                {item.detail}
              </details>
            )}
          </div>
        ))}
    </div>
  );
}
