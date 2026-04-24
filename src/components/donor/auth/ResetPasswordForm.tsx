"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { checkPasswordStrength } from "@/lib/security/password-policy";

/**
 * G-D26: 비밀번호 재설정 폼
 *
 * Supabase가 재설정 링크를 클릭한 순간 일회성 세션을 생성하며,
 * 이 페이지에 진입한 시점에 session 이 존재해야 정상 경로.
 * - 세션 없으면 "링크 만료/무효" 안내
 * - 제출 시 updateUser({ password }) 로 변경
 */
export function ResetPasswordForm() {
  const router = useRouter();
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<
    { kind: "idle" } | { kind: "saving" } | { kind: "ok" } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const strength = checkPasswordStrength(pwd);
    if (!strength.ok) {
      setState({ kind: "err", msg: strength.error ?? "비밀번호가 약합니다." });
      return;
    }
    if (pwd !== confirm) {
      setState({ kind: "err", msg: "비밀번호 확인이 일치하지 않습니다." });
      return;
    }
    setState({ kind: "saving" });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) {
        setState({ kind: "err", msg: "변경에 실패했습니다. 링크가 만료되었을 수 있습니다." });
        return;
      }
      setState({ kind: "ok" });
      setTimeout(() => {
        router.push("/donor");
        router.refresh();
      }, 1500);
    } catch {
      setState({ kind: "err", msg: "네트워크 오류가 발생했습니다." });
    }
  }

  if (hasSession === null) {
    return (
      <p
        className="text-center text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        확인 중…
      </p>
    );
  }

  if (!hasSession) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-4xl" aria-hidden="true">⚠️</p>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          링크가 유효하지 않거나 만료되었습니다
        </p>
        <a
          href="/donor/password/forgot"
          className="inline-block rounded-lg px-4 py-2 text-sm font-semibold text-white"
          style={{ background: "var(--accent)", textDecoration: "none" }}
        >
          다시 요청하기
        </a>
      </div>
    );
  }

  if (state.kind === "ok") {
    return (
      <div className="space-y-3 text-center">
        <p className="text-4xl">✅</p>
        <p className="text-sm font-medium" style={{ color: "var(--text)" }}>
          비밀번호가 변경되었습니다
        </p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          잠시 후 마이페이지로 이동합니다…
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label
          htmlFor="new-pwd"
          className="block text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          새 비밀번호 (8자 이상, 2종류 이상 혼용)
        </label>
        <input
          id="new-pwd"
          type="password"
          autoComplete="new-password"
          required
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--text)",
          }}
        />
      </div>
      <div className="space-y-1.5">
        <label
          htmlFor="confirm-pwd"
          className="block text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          비밀번호 확인
        </label>
        <input
          id="confirm-pwd"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
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
        disabled={state.kind === "saving"}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {state.kind === "saving" ? "변경 중…" : "비밀번호 변경"}
      </button>
    </form>
  );
}
