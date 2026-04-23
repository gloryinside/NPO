"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ReferralRetryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handle() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/donor/referral/retry", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErr(data.error ?? "다시 실패했습니다. 잠시 후 재시도해 주세요.");
        return;
      }
      router.refresh();
    } catch {
      setErr("네트워크 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handle}
        disabled={busy}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: "var(--accent)" }}
      >
        {busy ? "발급 중…" : "다시 시도"}
      </button>
      {err && (
        <p className="text-xs" style={{ color: "var(--negative)" }}>
          {err}
        </p>
      )}
    </div>
  );
}
