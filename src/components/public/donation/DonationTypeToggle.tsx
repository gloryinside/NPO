'use client';

interface DonationTypeToggleProps {
  value: 'onetime' | 'regular';
  available: ('onetime' | 'regular')[];
  onChange: (v: 'onetime' | 'regular') => void;
}

const TYPE_CONFIG = {
  onetime: { icon: '✦', title: '일시후원', desc: '한 번의 소중한 나눔' },
  regular: { icon: '↻', title: '정기후원', desc: '매월 꾸준한 변화' },
} as const;

export default function DonationTypeToggle({ value, available, onChange }: DonationTypeToggleProps) {
  if (available.length <= 1) return null;

  return (
    <div className="flex gap-3">
      {available.map((type) => {
        const config = TYPE_CONFIG[type];
        const selected = value === type;
        return (
          <button
            key={type}
            onClick={() => onChange(type)}
            style={{
              border: selected ? '2px solid var(--accent)' : '1px solid var(--border)',
              background: selected ? 'var(--accent-soft)' : 'var(--surface-2)',
              color: 'var(--text)',
              minHeight: '44px',
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1 rounded-xl py-4 px-3 transition-all"
          >
            <span className="text-2xl">{config.icon}</span>
            <span className="text-sm font-bold">{config.title}</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{config.desc}</span>
          </button>
        );
      })}
    </div>
  );
}
