"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function EventRegisterButton({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [partySize, setPartySize] = useState(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function register() {
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/donor/events/${eventId}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partySize }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setError(d.error ?? "신청 실패");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <select
          value={partySize}
          onChange={(e) => setPartySize(Number(e.target.value))}
          className="rounded-md border bg-[var(--surface)] px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text)" }}
          disabled={isPending}
        >
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n}명</option>
          ))}
        </select>
        <button type="button" onClick={register} disabled={isPending}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          {isPending ? "신청 중…" : "신청"}
        </button>
      </div>
      {error && <span className="text-xs" style={{ color: "var(--negative)" }}>{error}</span>}
    </div>
  );
}
