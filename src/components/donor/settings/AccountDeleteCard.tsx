"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * G-D02: 계정 삭제 카드 (2단계 확인)
 *
 * Step 1: "계정 삭제 진행" 버튼 → 확인 영역 펼침
 * Step 2: 비밀번호 또는 "삭제" 문구 입력 + 체크박스 동의 → 삭제 실행
 */
export function AccountDeleteCard({ authMethod }: { authMethod: "supabase" | "otp" }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [agree, setAgree] = useState(false);
  const [status, setStatus] = useState<
    { kind: "idle" } | { kind: "deleting" } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  const canSubmit =
    agree &&
    (authMethod === "supabase" ? password.length > 0 : confirmText === "삭제");

  async function handleDelete() {
    if (!canSubmit) return;
    setStatus({ kind: "deleting" });
    try {
      const res = await fetch("/api/donor/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          authMethod === "supabase"
            ? { currentPassword: password }
            : { confirmText }
        ),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setStatus({ kind: "err", msg: data.error ?? "삭제에 실패했습니다." });
        return;
      }
      // 세션이 끊겼으므로 로그인 페이지로
      router.push("/donor/login?deleted=1");
      router.refresh();
    } catch {
      setStatus({ kind: "err", msg: "네트워크 오류가 발생했습니다." });
    }
  }

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        borderColor: "rgba(239,68,68,0.35)",
        background: "var(--surface)",
      }}
    >
      <div className="p-5">
        <h3 className="text-sm font-semibold" style={{ color: "var(--negative)" }}>
          ⚠️ 계정 삭제
        </h3>
        <p
          className="mt-1 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          계정을 삭제하면 개인정보가 마스킹 처리되며, 진행 중인 모든 약정이
          해지됩니다. 과거 후원 이력과 영수증은 회계·세무 목적으로 보존됩니다.
        </p>

        {!expanded ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-4 rounded-lg border px-3 py-1.5 text-xs font-medium transition-opacity hover:opacity-80"
            style={{
              borderColor: "rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.08)",
              color: "var(--negative)",
            }}
          >
            계정 삭제 진행
          </button>
        ) : (
          <div className="mt-4 space-y-3">
            {authMethod === "supabase" ? (
              <div>
                <label
                  htmlFor="del-pwd"
                  className="block text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  현재 비밀번호
                </label>
                <input
                  id="del-pwd"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                />
              </div>
            ) : (
              <div>
                <label
                  htmlFor="del-confirm"
                  className="block text-xs font-medium"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  확인을 위해 <b>삭제</b> 라고 입력해주세요
                </label>
                <input
                  id="del-confirm"
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="삭제"
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm outline-none"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                  }}
                />
              </div>
            )}

            <label className="flex cursor-pointer items-start gap-2 text-xs">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5"
              />
              <span style={{ color: "var(--text)" }}>
                삭제 후에는 되돌릴 수 없으며, 활성 약정이 자동 해지됨을
                이해했습니다.
              </span>
            </label>

            {status.kind === "err" && (
              <p
                className="text-xs font-medium"
                style={{ color: "var(--negative)" }}
              >
                {status.msg}
              </p>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDelete}
                disabled={!canSubmit || status.kind === "deleting"}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: "var(--negative)" }}
              >
                {status.kind === "deleting" ? "삭제 중…" : "영구 삭제"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExpanded(false);
                  setPassword("");
                  setConfirmText("");
                  setAgree(false);
                  setStatus({ kind: "idle" });
                }}
                className="rounded-lg border px-4 py-2 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--surface-2)",
                  color: "var(--text)",
                }}
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
