"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { LETTER_MAX, LETTER_MIN, type DonorLetter } from "@/lib/sponsorship/letters";

/** 결연 아이와 주고받은 편지 + 편지 쓰기 (마이페이지 > 내 결연) */
export function SponsorLetters({ sponsorshipId, canWrite, childName }: { sponsorshipId: string; canWrite: boolean; childName: string }) {
  const textId = useId();
  const [letters, setLetters] = useState<DonorLetter[] | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/donor/sponsorships/${sponsorshipId}/letters`);
    const data = (await res.json().catch(() => ({}))) as { letters?: DonorLetter[] };
    setLetters(res.ok ? data.letters ?? [] : []);
  }, [sponsorshipId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setMessage(null);
    const res = await fetch(`/api/donor/sponsorships/${sponsorshipId}/letters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSending(false);
    if (!res.ok) return setMessage({ kind: "error", text: data.error ?? "편지를 보내지 못했어요." });
    setText("");
    setMessage({ kind: "ok", text: "편지를 보냈어요. 기관이 확인한 뒤 전해 드려요." });
    void load();
  }

  const length = text.trim().length;

  return (
    <div className="mt-5">
      <p className="text-sm font-semibold text-[var(--text)]">편지</p>

      {letters === null ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">불러오는 중…</p>
      ) : letters.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">아직 주고받은 편지가 없어요.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {letters.map((l) => (
            <li
              key={l.id}
              className={`rounded-md border p-3 text-sm ${l.fromMe ? "border-[var(--border)] bg-[var(--surface-2)]" : "border-[var(--accent)] bg-[var(--accent-soft)]"}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--text)]">{l.fromMe ? "내가 보낸 편지" : `${childName}의 편지`}</span>
                <span>
                  {l.statusLabel && <>{l.statusLabel} · </>}
                  {new Date(l.date).toLocaleDateString("ko-KR")}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-[var(--text)]">{l.text}</p>
              {l.note && <p className="mt-1 text-xs text-[var(--negative)]">사유: {l.note}</p>}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form onSubmit={send} className="mt-3 space-y-2">
          <label htmlFor={textId} className="block text-xs text-[var(--muted-foreground)]">
            아이에게 편지 쓰기 — 기관이 내용을 확인하고(필요하면 번역해) 전해 드려요. 연락처·주소 같은 개인정보는 적지 말아 주세요.
          </label>
          <textarea
            id={textId}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={LETTER_MAX}
            rows={4}
            className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 text-sm text-[var(--text)]"
          />
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs tabular-nums text-[var(--muted-foreground)]">
              {length.toLocaleString("ko-KR")} / {LETTER_MAX.toLocaleString("ko-KR")}자
            </span>
            <button
              type="submit"
              disabled={sending || length < LETTER_MIN}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {sending ? "보내는 중…" : "편지 보내기"}
            </button>
          </div>
          {message && (
            <p role={message.kind === "error" ? "alert" : "status"} className={`text-xs ${message.kind === "error" ? "text-[var(--negative)]" : "text-[var(--positive)]"}`}>
              {message.text}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
