"use client";

import { useState } from "react";

/**
 * G-D26: 비밀번호 재설정 이메일 요청 폼
 * 존재 여부 무관하게 "메일 전송됨"으로 통일 (enumeration 방지)
 */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "loading" } | { kind: "sent" } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/donor/password/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({ kind: "err", msg: data.error ?? "요청에 실패했습니다." });
        return;
      }
      setState({ kind: "sent" });
    } catch {
      setState({ kind: "err", msg: "네트워크 오류가 발생했습니다." });
    }
  }

  if (state.kind === "sent") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl">📧</p>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          재설정 이메일을 전송했습니다
        </p>
        <p
          className="text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          입력한 이메일로 계정이 있다면 재설정 링크가 전송됩니다.
          <br />
          수 분 내 도착하지 않으면 스팸함을 확인해주세요.
        </p>
        <a
          href="/donor/login"
          className="inline-block rounded-lg px-4 py-2 text-sm font-medium"
          style={{
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            textDecoration: "none",
          }}
        >
          로그인 페이지로
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="forgot-email"
          className="block text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          이메일
        </label>
        <input
          id="forgot-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="donor@example.com"
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
          }}
        />
      </div>

      {state.kind === "err" && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>
          {state.msg}
        </p>
      )}

      <button
        type="submit"
        disabled={state.kind === "loading" || !email.trim()}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {state.kind === "loading" ? "전송 중…" : "재설정 링크 받기"}
      </button>

      <p
        className="text-center text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        <a
          href="/donor/login"
          className="hover:underline"
          style={{ color: "var(--accent)" }}
        >
          ← 로그인으로 돌아가기
        </a>
      </p>
    </form>
  );
}
