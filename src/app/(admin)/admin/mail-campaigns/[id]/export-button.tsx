"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ExportButton({
  campaignId,
  disabled,
}: {
  campaignId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function exportCsv() {
    if (!window.confirm("명단을 추출하고 CSV를 다운로드합니다. 계속하시겠습니까?")) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/mail-campaigns/${campaignId}/export`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? `실패 (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mail-${campaignId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" onClick={exportCsv} disabled={isPending || disabled}
        className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: "var(--accent)" }}>
        {isPending ? "추출 중…" : "명단 추출 + CSV 다운로드"}
      </button>
      {disabled && (
        <p className="text-xs text-[var(--muted-foreground)]">
          이미 추출된 캠페인입니다. 다시 추출하려면 새 캠페인을 만드세요.
        </p>
      )}
      {error && <p className="text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
