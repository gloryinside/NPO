"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/**
 * 단순한 "버튼 → fetch(url, body) → router.refresh()" 헬퍼.
 * 어드민 페이지에서 한 줄짜리 액션을 빠르게 붙일 때 사용.
 */
export function JsonPostButton({
  url,
  method = "POST",
  body,
  label,
  confirm,
  variant = "default",
  onSuccess,
}: {
  url: string;
  method?: "POST" | "PATCH" | "PUT" | "DELETE";
  body?: Record<string, unknown>;
  label: ReactNode;
  confirm?: string;
  variant?: "default" | "primary" | "danger";
  onSuccess?: (data: unknown) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (confirm && !window.confirm(confirm)) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `실패 (${res.status})`);
          return;
        }
        const data = await res.json().catch(() => ({}));
        onSuccess?.(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }

  const styles: Record<typeof variant, string> = {
    default: "border-[var(--border)] bg-[var(--surface)] text-[var(--text)]",
    primary: "border-[var(--accent)] bg-[var(--accent)] text-white",
    danger: "border-[var(--negative)] bg-[var(--negative)] text-white",
  };

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className={`rounded-md border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${styles[variant]}`}
      >
        {isPending ? "처리 중…" : label}
      </button>
      {error && (
        <span className="text-xs" style={{ color: "var(--negative)" }}>
          {error}
        </span>
      )}
    </span>
  );
}
