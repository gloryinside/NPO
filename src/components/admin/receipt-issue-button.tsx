"use client";

import { useState } from "react";
import { toast } from "sonner";

/**
 * 후원자 상세의 "영수증 발급" — POST로 발급(이미 있으면 그 영수증)하고 PDF를 내려받는다.
 * (예전: GET 링크가 발급까지 해서 CSRF로 발급을 일으킬 수 있었다)
 */
export function ReceiptIssueButton({ memberId, year, className }: { memberId: string; year: number; className?: string }) {
  const [busy, setBusy] = useState(false);

  async function issue() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/receipts/${memberId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string; issues?: Array<{ message: string }> };
        toast.error(data.error ?? "영수증 발급 실패", {
          description: data.issues?.map((i) => i.message).join(" · "),
        });
        return;
      }
      const name = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `receipt-${year}.pdf`;
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" onClick={issue} disabled={busy} className={className}>
      {busy ? "발급 중…" : "영수증 발급"}
    </button>
  );
}
