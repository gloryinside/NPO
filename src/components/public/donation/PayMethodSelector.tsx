'use client';

interface PayMethodSelectorProps {
  methods: string[];
  value: string;
  onChange: (method: string) => void;
}

const METHOD_CONFIG: Record<string, { icon: string; label: string }> = {
  card: { icon: '💳', label: '카드' },
  kakaopay: { icon: '💛', label: '카카오페이' },
  naverpay: { icon: '🟢', label: '네이버페이' },
  payco: { icon: '🔴', label: 'PAYCO' },
  virtual: { icon: '🏦', label: '가상계좌' },
  cms: { icon: '📋', label: 'CMS' },
};

export default function PayMethodSelector({ methods, value, onChange }: PayMethodSelectorProps) {
  if (methods.length <= 1) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {methods.map((method) => {
        const config = METHOD_CONFIG[method] ?? { icon: '💰', label: method };
        const selected = value === method;
        return (
          <button
            type="button"
            key={method}
            onClick={() => onChange(method)}
            className={[
              'flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium min-h-[44px] transition-all',
              selected
                ? 'bg-[var(--accent)] text-white border-0'
                : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)]',
            ].join(' ')}
          >
            <span>{config.icon}</span>
            <span>{config.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export { PayMethodSelector };
