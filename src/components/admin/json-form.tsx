"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export interface FormField {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "datetime-local" | "select" | "textarea" | "checkbox";
  required?: boolean;
  placeholder?: string;
  defaultValue?: string | number | boolean;
  options?: Array<{ value: string; label: string }>;
  step?: string;
  min?: number;
  max?: number;
  rows?: number;
  helpText?: string;
}

/**
 * 어드민 페이지에서 짧은 생성/편집 폼을 빠르게 붙이기 위한 공용 컴포넌트.
 * - body 빌드: number/checkbox 자동 변환
 * - 성공 시 router.refresh + onSuccess 콜백
 */
export function JsonForm({
  url,
  method = "POST",
  fields,
  submitLabel = "저장",
  onSuccess,
  successMessage,
  extra,
}: {
  url: string;
  method?: "POST" | "PATCH" | "PUT";
  fields: FormField[];
  submitLabel?: string;
  onSuccess?: (data: unknown) => void;
  successMessage?: string;
  /** 폼에 추가로 합쳐서 보낼 정적 값 */
  extra?: Record<string, unknown>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function submit(formData: FormData) {
    setError(null);
    setDone(false);
    startTransition(async () => {
      const body: Record<string, unknown> = { ...(extra ?? {}) };
      for (const f of fields) {
        const raw = formData.get(f.name);
        if (raw === null) continue;
        if (f.type === "number") {
          const v = Number(raw);
          if (!Number.isNaN(v) && raw !== "") body[f.name] = v;
        } else if (f.type === "checkbox") {
          body[f.name] = raw === "on" || raw === "true";
        } else {
          const s = String(raw);
          if (s !== "" || f.required) body[f.name] = s;
        }
      }
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          setError(data.error ?? `실패 (${res.status})`);
          return;
        }
        const data = await res.json().catch(() => ({}));
        setDone(true);
        onSuccess?.(data);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "네트워크 오류");
      }
    });
  }

  return (
    <form action={submit} className="space-y-3">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label className="text-xs font-medium text-[var(--muted-foreground)]">
            {f.label}
            {f.required && <span className="ml-1 text-[var(--negative)]">*</span>}
          </label>
          {f.type === "textarea" ? (
            <textarea
              name={f.name}
              required={f.required}
              placeholder={f.placeholder}
              defaultValue={f.defaultValue as string | undefined}
              rows={f.rows ?? 3}
              className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
          ) : f.type === "select" ? (
            <select
              name={f.name}
              required={f.required}
              defaultValue={f.defaultValue as string | undefined}
              className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            >
              {!f.required && <option value="">— 선택 —</option>}
              {f.options?.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : f.type === "checkbox" ? (
            <input
              type="checkbox"
              name={f.name}
              defaultChecked={f.defaultValue === true}
              className="h-4 w-4"
            />
          ) : (
            <input
              type={f.type ?? "text"}
              name={f.name}
              required={f.required}
              placeholder={f.placeholder}
              defaultValue={
                typeof f.defaultValue === "boolean"
                  ? undefined
                  : (f.defaultValue as string | number | undefined)
              }
              step={f.step}
              min={f.min}
              max={f.max}
              className="rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
          )}
          {f.helpText && (
            <p className="text-xs text-[var(--muted-foreground)]">{f.helpText}</p>
          )}
        </div>
      ))}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}
        >
          {isPending ? "저장 중…" : submitLabel}
        </button>
        {error && (
          <span className="text-xs" style={{ color: "var(--negative)" }}>
            {error}
          </span>
        )}
        {done && !error && (
          <span className="text-xs" style={{ color: "var(--positive)" }}>
            {successMessage ?? "저장됨"}
          </span>
        )}
      </div>
    </form>
  );
}
