"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function MatchingRequestActions({
  requestId,
  status,
}: {
  requestId: string;
  status: string;
}) {
  const router = useRouter();
  const [matchPaymentId, setMatchPaymentId] = useState("");
  const [rejectedReason, setRejectedReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(action: "approved" | "rejected" | "fulfilled") {
    setError(null);
    startTransition(async () => {
      const body: Record<string, unknown> = { status: action };
      if (action === "rejected") body.rejectedReason = rejectedReason;
      if (action === "fulfilled") body.matchPaymentId = matchPaymentId;
      const res = await fetch(`/api/admin/matching-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {status === "pending" && (
        <>
          <button type="button" onClick={() => patch("approved")} disabled={isPending}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--accent)" }}>
            승인
          </button>
          <input value={rejectedReason} onChange={(e) => setRejectedReason(e.target.value)}
            placeholder="거절 사유"
            className="rounded-md border bg-[var(--surface)] px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
          <button type="button" onClick={() => patch("rejected")} disabled={isPending || !rejectedReason}
            className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            style={{ borderColor: "var(--negative)", color: "var(--negative)", background: "var(--surface)" }}>
            거절
          </button>
        </>
      )}
      {status === "approved" && (
        <>
          <input value={matchPaymentId} onChange={(e) => setMatchPaymentId(e.target.value)}
            placeholder="기업 매칭 결제 ID (payments)"
            className="rounded-md border bg-[var(--surface)] px-2 py-1 text-xs"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
          <button type="button" onClick={() => patch("fulfilled")} disabled={isPending || !matchPaymentId}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--positive)" }}>
            매칭 결제 완료
          </button>
        </>
      )}
      {error && <span className="text-xs" style={{ color: "var(--negative)" }}>{error}</span>}
    </div>
  );
}
