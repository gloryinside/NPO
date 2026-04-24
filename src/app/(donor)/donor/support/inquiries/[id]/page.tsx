import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

const STATUS_LABEL: Record<string, string> = {
  open: "답변 대기",
  answered: "답변 완료",
  closed: "종료",
};
const STATUS_CLASS: Record<string, string> = {
  open: "text-[var(--warning)]",
  answered: "text-[var(--positive)]",
  closed: "text-[var(--muted-foreground)]",
};

type Reply = { id: string; author_role: string; body: string; created_at: string };
type Inquiry = {
  id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  created_at: string;
  inquiry_replies: Reply[];
};

function formatDt(iso: string) {
  try { return new Date(iso).toLocaleString("ko-KR"); } catch { return iso; }
}

export async function generateMetadata({ params }: { params: RouteParams }) {
  const { id } = await params;
  return { title: `문의 #${id.slice(0, 8)}` };
}

export default async function DonorInquiryDetailPage({ params }: { params: RouteParams }) {
  const { id } = await params;
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("inquiries")
    .select("id, subject, body, category, status, created_at, inquiry_replies(id, author_role, body, created_at)")
    .eq("id", id)
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .maybeSingle();

  if (!data) notFound();
  const inquiry = data as unknown as Inquiry;
  const replies = inquiry.inquiry_replies ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <Link href="/donor/support/inquiries" className="text-sm text-[var(--muted-foreground)]">
          ← 내 문의
        </Link>
      </div>

      {/* 문의 원문 */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium ${STATUS_CLASS[inquiry.status] ?? "text-[var(--muted-foreground)]"}`}>
            {STATUS_LABEL[inquiry.status] ?? inquiry.status}
          </span>
          <h1 className="text-lg font-bold text-[var(--text)]">{inquiry.subject}</h1>
        </div>
        <time className="text-xs text-[var(--muted-foreground)]">{formatDt(inquiry.created_at)}</time>
        <p className="text-sm text-[var(--text)] whitespace-pre-wrap leading-relaxed pt-3 border-t border-[var(--border)]">
          {inquiry.body}
        </p>
      </div>

      {/* 대화 스레드 */}
      {replies.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-[var(--muted-foreground)]">답변</h2>
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
                  {r.author_role === "admin" ? "담당자" : "나"}
                </span>
                <span>·</span>
                <time>{formatDt(r.created_at)}</time>
              </div>
              <p className="whitespace-pre-wrap text-[var(--text)] leading-relaxed">{r.body}</p>
            </div>
          ))}
        </div>
      )}

      {inquiry.status === "open" && replies.length === 0 && (
        <div className="rounded-lg border border-dashed py-6 text-center border-[var(--border)] text-sm text-[var(--muted-foreground)]">
          담당자가 검토 후 답변드릴 예정입니다.
        </div>
      )}
    </div>
  );
}
