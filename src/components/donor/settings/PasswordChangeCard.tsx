"use client";

import { useState } from "react";
import { checkPasswordStrength } from "@/lib/security/password-policy";

/**
 * G-D01: 비밀번호 변경 카드
 * - Supabase 이메일/비번 계정에서만 노출 (disabled 일 때 안내 메시지만 표시)
 */
export function PasswordChangeCard({ enabled }: { enabled: boolean }) {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const strength = checkPasswordStrength(next);
    if (!strength.ok) {
      setStatus({ kind: "err", msg: strength.error ?? "비밀번호가 약합니다." });
      return;
    }
    if (next !== confirm) {
      setStatus({ kind: "err", msg: "새 비밀번호 확인이 일치하지 않습니다." });
      return;
    }
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/donor/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error ?? "변경에 실패했습니다." });
        return;
      }
      setStatus({ kind: "ok" });
      setCur("");
      setNext("");
      setConfirm("");
    } catch {
      setStatus({ kind: "err", msg: "네트워크 오류가 발생했습니다." });
    }
  }

  if (!enabled) {
    return (
      <div
        className="rounded-2xl border p-5 text-sm"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface)",
          color: "var(--muted-foreground)",
        }}
      >
        휴대폰 인증으로 로그인한 계정은 비밀번호가 없습니다.
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border p-5 space-y-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <Field
        id="cur-pwd"
        label="현재 비밀번호"
        type="password"
        value={cur}
        onChange={setCur}
        autoComplete="current-password"
      />
      <Field
        id="new-pwd"
        label="새 비밀번호 (8자 이상, 2종류 이상 혼용)"
        type="password"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <Field
        id="confirm-pwd"
        label="새 비밀번호 확인"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />

      <div className="flex items-center justify-between pt-2">
        <StatusMessage status={status} />
        <button
          type="submit"
          disabled={status.kind === "saving" || !cur || !next || !confirm}
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          style={{ background: "var(--accent)" }}
        >
          {status.kind === "saving" ? "변경 중…" : "비밀번호 변경"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs font-medium"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        style={{
          borderColor: "var(--border)",
          background: "var(--surface-2)",
          color: "var(--text)",
        }}
      />
    </div>
  );
}

function StatusMessage({
  status,
}: {
  status:
    | { kind: "idle" }
    | { kind: "saving" }
    | { kind: "ok" }
    | { kind: "err"; msg: string };
}) {
  if (status.kind === "ok") {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--positive)" }}>
        ✓ 비밀번호가 변경되었습니다.
      </span>
    );
  }
  if (status.kind === "err") {
    return (
      <span className="text-xs font-medium" style={{ color: "var(--negative)" }}>
        {status.msg}
      </span>
    );
  }
  return <span />;
}
