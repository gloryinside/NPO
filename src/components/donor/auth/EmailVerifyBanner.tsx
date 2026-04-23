"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * G-D55: Supabase 이메일 계정인데 이메일 미인증 상태에서
 * 대시보드 상단에 표시하는 배너 + 인증 재발송 버튼.
 *
 * (전면 차단 대신 배너로 안내 — 기부 이력 조회 등 읽기 기능은 허용하되
 *  쓰기 액션 측은 각 엔드포인트가 인증 요건에 따라 추후 강화)
 */
export function EmailVerifyBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "loading" }
    | { kind: "sent" }
    | { kind: "err"; msg: string }
  >({ kind: "idle" });

  async function resend() {
    setStatus({ kind: "loading" });
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
      });
      if (error) {
        setStatus({ kind: "err", msg: "재발송에 실패했습니다." });
        return;
      }
      setStatus({ kind: "sent" });
    } catch {
      setStatus({ kind: "err", msg: "네트워크 오류가 발생했습니다." });
    }
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3"
      style={{
        borderColor: "var(--warning)",
        background: "var(--warning-soft)",
        color: "var(--warning)",
      }}
    >
      <p className="text-sm">
        <b>✉️ 이메일 인증이 필요합니다.</b>{" "}
        <span className="text-xs opacity-80">
          {email} 로 전송된 메일에서 인증 링크를 클릭해주세요.
        </span>
      </p>
      <div className="flex items-center gap-2">
        {status.kind === "sent" ? (
          <span className="text-xs font-semibold">✓ 재발송 완료</span>
        ) : status.kind === "err" ? (
          <span className="text-xs font-semibold">{status.msg}</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={status.kind === "loading"}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: "var(--warning)" }}
          >
            {status.kind === "loading" ? "발송 중…" : "인증 메일 재발송"}
          </button>
        )}
      </div>
    </div>
  );
}
