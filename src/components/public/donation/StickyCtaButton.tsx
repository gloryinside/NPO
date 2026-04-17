'use client';

interface StickyCtaButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function StickyCtaButton({ label, onClick, disabled, loading }: StickyCtaButtonProps) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'linear-gradient(to bottom, transparent, var(--bg) 40%)',
        paddingTop: '16px',
        paddingBottom: '16px',
      }}
    >
      <button
        onClick={onClick}
        disabled={disabled || loading}
        style={{ background: 'var(--accent)', color: '#fff', width: '100%', minHeight: '48px' }}
        className="rounded-xl text-base font-bold disabled:opacity-50"
      >
        {loading ? '처리 중…' : label}
      </button>
    </div>
  );
}
