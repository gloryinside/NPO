"use client";

import { useEffect, useRef } from "react";

/**
 * G-D204: dialog/modal 공용 focus trap + Escape + 이전 포커스 복원 훅.
 *
 * 사용:
 *   const ref = useFocusTrap<HTMLDivElement>(open, () => onClose());
 *   <div ref={ref} role="dialog" aria-modal="true">...</div>
 *
 * - open=true 진입 시 컨테이너 내부 첫 포커스 가능한 요소로 이동
 * - Tab / Shift+Tab 시 컨테이너 내부 순환
 * - Escape → onClose
 * - unmount/close 시 이전 포커스 복원
 */
const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function useFocusTrap<T extends HTMLElement>(
  open: boolean,
  onClose?: () => void
) {
  const ref = useRef<T | null>(null);
  const prevRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    prevRef.current = document.activeElement as HTMLElement | null;

    // 초기 포커스
    const container = ref.current;
    if (container) {
      const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      focusables[0]?.focus();
    }

    function onKey(e: KeyboardEvent) {
      if (!ref.current) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;
      const focusables = ref.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prevRef.current?.focus?.();
    };
  }, [open, onClose]);

  return ref;
}
