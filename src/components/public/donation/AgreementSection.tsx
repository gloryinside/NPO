'use client';

interface AgreementValue {
  allChecked: boolean;
  terms: boolean;
  privacy: boolean;
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

export default function AgreementSection({
  requireReceipt,
  marketingLabel,
  value,
  onChange,
}: AgreementSectionProps) {
  const computeAllChecked = (v: Omit<AgreementValue, 'allChecked'>): boolean => {
    if (!v.terms || !v.privacy) return false;
    if (requireReceipt && !v.receipt) return false;
    if (marketingLabel && !v.marketing) return false;
    return true;
  };

  const handleAll = (checked: boolean) => {
    onChange({
      allChecked: checked,
      terms: checked,
      privacy: checked,
      receipt: checked,
      marketing: checked,
    });
  };

  const handleItem = (key: keyof Omit<AgreementValue, 'allChecked'>, checked: boolean) => {
    const next = { ...value, [key]: checked };
    onChange({ ...next, allChecked: computeAllChecked(next) });
  };

  const checkboxStyle: React.CSSProperties = {
    accentColor: 'var(--accent)',
    width: '18px',
    height: '18px',
    flexShrink: 0,
    cursor: 'pointer',
  };

  const items: { key: keyof Omit<AgreementValue, 'allChecked'>; label: string; show: boolean }[] = [
    { key: 'terms', label: '후원 이용약관 동의 (필수)', show: true },
    { key: 'privacy', label: '개인정보 처리방침 동의 (필수)', show: true },
    { key: 'receipt', label: '기부금 영수증 발급 동의 (필수)', show: requireReceipt },
    { key: 'marketing', label: `${marketingLabel ?? ''} (선택)`, show: !!marketingLabel },
  ];

  return (
    <div
      style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        color: 'var(--text)',
      }}
      className="rounded-xl p-4 flex flex-col gap-3"
    >
      {/* All agree */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          style={checkboxStyle}
          checked={value.allChecked}
          onChange={(e) => handleAll(e.target.checked)}
        />
        <span className="font-bold text-sm">전체 동의</span>
      </label>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Individual items */}
      {items
        .filter((item) => item.show)
        .map((item) => (
          <label key={item.key} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              style={checkboxStyle}
              checked={value[item.key]}
              onChange={(e) => handleItem(item.key, e.target.checked)}
            />
            <span className="text-sm">{item.label}</span>
          </label>
        ))}
    </div>
  );
}
