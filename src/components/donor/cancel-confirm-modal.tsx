'use client';

import { useEffect, useRef, useState } from 'react';

interface CancelConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

/**
 * G-D39: 커스텀 모달에 focus trap / Escape / backdrop 닫기 추가.
 */
export function CancelConfirmModal({
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: CancelConfirmModalProps) {
  const [loading, setLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusableRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  // Focus trap + 초기 포커스 + Escape + 이전 포커스 복원
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    firstFocusableRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (!loading) onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const container = dialogRef.current;
      if (!container) return;
      const focusables = container.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previouslyFocused.current?.focus?.();
    };
  }, [loading, onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-confirm-title"
      aria-describedby="cancel-confirm-desc"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => {
        // backdrop 클릭 시 닫기 (진행 중이 아니면)
        if (e.target === e.currentTarget && !loading) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="mx-4 w-full max-w-sm rounded-xl p-6"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <h3
          id="cancel-confirm-title"
          className="text-lg font-bold mb-2"
          style={{ color: 'var(--text)' }}
        >
          {title}
        </h3>
        <p
          id="cancel-confirm-desc"
          className="text-sm mb-5"
          style={{ color: 'var(--muted-foreground)' }}
        >
          {message}
        </p>
        <div className="flex gap-2">
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg py-2.5 text-sm"
            style={{
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--negative)' }}
          >
            {loading ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
