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
          계정을 삭제하면 개인정보가 즉시 마스킹 처리되며, 진행 중인 모든
          약정이 해지됩니다.
        </p>

        {/* G-D45: 결제 수단 영구 삭제 경고 */}
        <ul
          className="mt-3 space-y-1 text-xs"
          style={{ color: "var(--muted-foreground)" }}
        >
          <li>• 등록된 <b style={{ color: "var(--text)" }}>카드 결제 수단(빌링키)</b>이 즉시 영구 삭제됩니다.</li>
          <li>• 다시 후원하시려면 <b style={{ color: "var(--text)" }}>새로 가입</b>하고 결제 수단을 재등록해야 합니다.</li>
          <li>• 일시 중단을 원하면 삭제 대신 각 약정에서 <b style={{ color: "var(--text)" }}>일시중지</b>를 사용하세요.</li>
        </ul>

        {/* 법적 보존 안내 — 개인정보보호법상 보유 기간 명시 의무 */}
        <div
          className="mt-3 rounded-lg border p-3 text-xs leading-relaxed"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface-2)",
            color: "var(--muted-foreground)",
          }}
        >
          <p className="font-semibold" style={{ color: "var(--text)" }}>
            보존되는 정보 · 근거 법령
          </p>
          <ul className="mt-1 space-y-0.5">
            <li>
              · <b>기부금 영수증 발급 내역</b>: 소득세법 시행령 제81조의7에 따라
              <b> 최소 5년</b> 보존
            </li>
            <li>
              · <b>결제(납입) 이력</b>: 전자상거래법 제6조에 따라
              <b> 최소 5년</b> 보존
            </li>
            <li>
              · 보존 기간 경과 후 <b>자동 익명화</b> 또는 영구 파기
            </li>
          </ul>
          <p className="mt-2">
            본인 데이터를 삭제 전 일괄 다운로드 받으시려면 위의{" "}
            <b style={{ color: "var(--text)" }}>내 데이터 내보내기</b>를
            이용하세요.
          </p>
        </div>

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
                삭제 후에는 되돌릴 수 없으며, 활성 약정과 등록된 카드가
                영구 삭제됨을 이해했습니다.
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
