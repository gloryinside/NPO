"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const CATEGORIES = [
  { value: "general", label: "일반" },
  { value: "payment", label: "결제" },
  { value: "receipt", label: "영수증" },
  { value: "donation", label: "후원" },
  { value: "other", label: "기타" },
];

export default function NewInquiryPage() {
  const router = useRouter();
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!subject.trim() || !body.trim()) return;
    setSubmitting(true);
    setErr("");
    const res = await fetch("/api/donor/inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, subject, body }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string; id?: string };
    if (!res.ok) { setErr(data.error ?? "오류가 발생했습니다."); setSubmitting(false); return; }
    router.push(`/donor/support/inquiries/${data.id}`);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <Link href="/donor/support/inquiries" className="text-sm text-[var(--muted-foreground)]">
          ← 내 문의
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">문의하기</h1>
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
            문의 유형
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
            제목
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={200}
            placeholder="문의 제목을 입력하세요"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--muted-foreground)]"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">
            내용
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={3000}
            rows={7}
            placeholder="문의 내용을 자세히 입력해 주세요"
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--muted-foreground)]"
          />
          <p className="mt-1 text-right text-xs text-[var(--muted-foreground)]">{body.length}/3000</p>
        </div>

        {err && <p className="text-xs text-[var(--negative)]">{err}</p>}

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !subject.trim() || !body.trim()}
          className="w-full rounded-lg bg-[var(--accent)] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
        >
          {submitting ? "제출 중…" : "문의 제출"}
        </button>
      </div>
    </div>
  );
}
