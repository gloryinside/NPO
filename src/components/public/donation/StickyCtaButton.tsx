'use client';

interface StickyCtaButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function StickyCtaButton({ label, onClick, disabled, loading }: StickyCtaButtonProps) {
  return (
    <div className="sticky bottom-0 bg-gradient-to-b from-transparent via-[var(--bg)] to-[var(--bg)] pt-4 pb-4">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        className="w-full min-h-[48px] rounded-xl bg-[var(--accent)] text-white text-base font-bold disabled:opacity-50"
      >
        {loading ? '처리 중…' : label}
      </button>
    </div>
  );
}

export { StickyCtaButton };
