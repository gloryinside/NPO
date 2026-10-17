"use client";

import { useEffect, useState, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  open: "답변 대기",
  answered: "답변 완료",
  closed: "종료",
};
const STATUS_COLOR: Record<string, string> = {
  open: "text-[var(--warning)]",
  answered: "text-[var(--positive)]",
  closed: "text-[var(--muted-foreground)]",
};

type Reply = { id: string; author_role: string; body: string; created_at: string };
type Inquiry = {
  id: string;
  category: string;
  subject: string;
  body: string;
  status: string;
  created_at: string;
  answered_at: string | null;
  members: { id: string; name: string | null; email: string | null } | null;
  inquiry_replies: Reply[];
};

function formatDt(iso: string) {
  try { return new Date(iso).toLocaleString("ko-KR"); } catch { return iso; }
}

export default function AdminInquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function load() {
    const res = await fetch(`/api/admin/inquiries/${id}`);
    if (res.ok) {
      const json = await res.json() as { inquiry: Inquiry };
      setInquiry(json.inquiry);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitReply() {
    if (!replyText.trim()) return;
    setSubmitting(true);
    setErr("");
    const res = await fetch(`/api/admin/inquiries/${id}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyText }),
    });
    const data = await res.json().catch(() => ({})) as { error?: string };
    if (!res.ok) { setErr(data.error ?? "오류가 발생했습니다."); setSubmitting(false); return; }
    setReplyText("");
    setSubmitting(false);
    startTransition(() => { load(); });
  }

  async function changeStatus(status: string) {
    await fetch(`/api/admin/inquiries/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    startTransition(() => { load(); });
  }

  if (loading) return <div className="text-[var(--muted-foreground)] p-8">로딩 중…</div>;
  if (!inquiry) return <div className="text-[var(--muted-foreground)] p-8">찾을 수 없습니다.</div>;

  const replies = inquiry.inquiry_replies ?? [];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/admin/inquiries" className="text-sm text-[var(--muted-foreground)]">
          ← 문의 목록
        </Link>
      </div>

      {/* 문의 헤더 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={`border-0 bg-[var(--surface-2)] ${STATUS_COLOR[inquiry.status]}`}>
            {STATUS_LABEL[inquiry.status] ?? inquiry.status}
          </Badge>
          <h1 className="text-lg font-bold text-[var(--text)]">{inquiry.subject}</h1>
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {inquiry.members?.name ?? "(알 수 없음)"} · {inquiry.members?.email ?? ""} ·{" "}
          {formatDt(inquiry.created_at)}
        </div>
        <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed pt-2 border-t border-[var(--border)]">
          {inquiry.body}
        </p>
        {/* 후원자 상세 링크 */}
        {inquiry.members?.id && (
          <div className="pt-1">
            <Link
              href={`/admin/members/${inquiry.members.id}`}
              className="text-xs text-[var(--accent)] hover:underline"
            >
              후원자 상세 보기 →
            </Link>
          </div>
        )}
      </div>

      {/* 대화 스레드 */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">대화 내역</h2>
          {replies.map((r) => (
            <div
              key={r.id}
              className={`rounded-xl p-4 text-sm ${
                r.author_role === "admin"
                  ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border border-[color-mix(in_srgb,var(--accent)_25%,transparent)]"
                  : "bg-[var(--surface-2)] border border-[var(--border)]"
              }`}
            >
              <div className="flex items-center gap-2 mb-2 text-xs text-[var(--muted-foreground)]">
                <span className="font-medium text-[var(--text)]">
                  {r.author_role === "admin" ? "관리자" : "후원자"}
                </span>
                <span>·</span>
                <time>{formatDt(r.created_at)}</time>
              </div>
              <p className="whitespace-pre-wrap text-[var(--text)] leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {/* 답변 입력 */}
      {inquiry.status !== "closed" && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3">
          <h2 className="text-sm font-semibold text-[var(--text)]">답변 작성</h2>
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="후원자에게 보낼 답변을 입력하세요…"
            rows={5}
            className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none resize-none border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] placeholder:text-[var(--muted-foreground)]"
          />
          {err && <p className="text-xs text-[var(--negative)]">{err}</p>}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={submitReply}
              disabled={submitting || !replyText.trim()}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            >
              {submitting ? "전송 중…" : "답변 등록"}
            </button>
            <button
              type="button"
              onClick={() => changeStatus("closed")}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-[var(--muted-foreground)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
            >
              문의 종료
            </button>
            {inquiry.status === "answered" && (
              <button
                type="button"
                onClick={() => changeStatus("open")}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-[var(--warning)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
              >
                재오픈
              </button>
            )}
          </div>
        </div>
      )}

      {inquiry.status === "closed" && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => { changeStatus("open"); router.refresh(); }}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-[var(--warning)] border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors"
          >
            문의 재오픈
          </button>
        </div>
      )}
    </div>
  );
}
