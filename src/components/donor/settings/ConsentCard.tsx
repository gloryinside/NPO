"use client";

import { useState } from "react";

/**
 * G-D98: 마케팅 동의 카드.
 * 서버 컴포넌트에서 초기값(initial)을 받아 낙관적 업데이트로 토글.
 */
export function ConsentCard({
  initial,
  initialAt,
}: {
  initial: boolean;
  initialAt: string | null;
}) {
  const [value, setValue] = useState(initial);
  const [at, setAt] = useState(initialAt);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");

  async function toggle() {
    const next = !value;
    setValue(next);
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/donor/consent", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingConsent: next }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        updatedAt?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setValue(!next); // 롤백
        setStatus("err");
        return;
      }
      setAt(data.updatedAt ?? null);
      setStatus("ok");
    } catch {
      setValue(!next);
      setStatus("err");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-2xl border p-5"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text)]">
            마케팅 · 뉴스레터 수신 동의
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            캠페인 진행 소식, 행사 안내, 후원 캠페인 초대 이메일을 받습니다.
            언제든 철회할 수 있으며, 결제·영수증 등 필수 알림에는 영향이 없습니다.
          </p>
          {at && (
            <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
              최근 변경: {new Date(at).toLocaleString("ko-KR")}
            </p>
          )}
          {status === "err" && (
            <p
              className="mt-2 text-xs"
              style={{ color: "var(--negative)" }}
            >
              변경에 실패했습니다. 잠시 후 다시 시도해주세요.
            </p>
          )}
        </div>

        {/* 토글 스위치 */}
        <label className="relative mt-0.5 shrink-0 cursor-pointer">
          <input
            type="checkbox"
            checked={value}
            onChange={toggle}
            disabled={saving}
            aria-label="마케팅 수신 동의"
            className="sr-only"
          />
          <div
            className="h-6 w-11 rounded-full transition-colors duration-200"
            style={{ background: value ? "var(--accent)" : "var(--border)" }}
          />
          <div
            className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200"
            style={{
              transform: value ? "translateX(1.25rem)" : "translateX(0.125rem)",
            }}
          />
        </label>
      </div>
    </div>
  );
}
