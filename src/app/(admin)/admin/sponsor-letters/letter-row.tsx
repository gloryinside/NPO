"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const DIRECTION_LABEL: Record<string, string> = {
  to_beneficiary: "후원자→수혜자",
  to_sponsor: "수혜자→후원자",
};

interface Props {
  row: {
    id: string;
    sponsorship_id: string;
    direction: string;
    original_text: string | null;
    translated_text: string | null;
    status: string;
    created_at: string;
  };
}

export function LetterRow({ row }: Props) {
  const router = useRouter();
  const [translatedText, setTranslatedText] = useState(row.translated_text ?? "");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function patch(status: string) {
    setError(null);
    startTransition(async () => {
      const body: Record<string, unknown> = { status };
      if (status === "translating" || status === "reviewed") {
        if (translatedText) body.translatedText = translatedText;
      }
      if (status === "rejected") body.rejectionReason = rejectionReason;
      const res = await fetch(`/api/admin/sponsor-letters/${row.id}`, {
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
    <div className="rounded-2xl border p-4"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: "var(--muted-foreground)" }}>
          {DIRECTION_LABEL[row.direction]} · 결연 #
          <Link href={`/admin/sponsorships/${row.sponsorship_id}`} style={{ color: "var(--accent)" }}>
            {row.sponsorship_id.slice(0, 8)}
          </Link>
        </span>
        <span style={{ color: "var(--muted-foreground)" }}>
          {new Date(row.created_at).toLocaleDateString("ko-KR")}
        </span>
      </div>

      {row.original_text && (
        <div className="mt-2">
          <p className="text-xs font-semibold text-[var(--muted-foreground)]">원본</p>
          <p className="mt-1 text-sm whitespace-pre-wrap" style={{ color: "var(--text)" }}>{row.original_text}</p>
        </div>
      )}

      <div className="mt-3">
        <p className="text-xs font-semibold text-[var(--muted-foreground)]">번역본</p>
        <textarea value={translatedText} onChange={(e) => setTranslatedText(e.target.value)}
          rows={4}
          className="mt-1 w-full rounded-md border bg-[var(--surface)] px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", color: "var(--text)" }} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => patch("translating")} disabled={isPending}
          className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}>
          번역 중 저장
        </button>
        <button type="button" onClick={() => patch("reviewed")} disabled={isPending || !translatedText}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "var(--accent)" }}>
          검수 완료
        </button>
        {row.status === "reviewed" && (
          <button type="button" onClick={() => patch("delivered")} disabled={isPending}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
            style={{ background: "var(--positive)" }}>
            전달 완료
          </button>
        )}
        <input value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)}
          placeholder="반려 사유"
          className="ml-2 rounded-md border bg-[var(--surface)] px-2 py-1 text-xs"
          style={{ borderColor: "var(--border)", color: "var(--text)" }} />
        <button type="button" onClick={() => patch("rejected")} disabled={isPending || !rejectionReason}
          className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50"
          style={{ borderColor: "var(--negative)", color: "var(--negative)", background: "var(--surface)" }}>
          반려
        </button>
      </div>

      {error && <p className="mt-2 text-xs" style={{ color: "var(--negative)" }}>{error}</p>}
    </div>
  );
}
