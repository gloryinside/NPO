import Link from "next/link";
import { getDonorSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "내 문의" };

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

type Row = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  answered_at: string | null;
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("ko-KR"); } catch { return iso; }
}

export default async function DonorInquiriesPage() {
  const session = await getDonorSession();
  if (!session) redirect("/donor/login");

  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("inquiries")
    .select("id, subject, status, created_at, answered_at")
    .eq("org_id", session.member.org_id)
    .eq("member_id", session.member.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data as Row[]) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href="/donor/support" className="text-sm text-[var(--muted-foreground)]">
            ← 고객지원
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[var(--text)]">내 문의</h1>
        </div>
        <Link
          href="/donor/support/inquiries/new"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white no-underline hover:opacity-90 transition-opacity"
        >
          문의하기
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          아직 문의 내역이 없습니다.
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)] bg-[var(--surface)]">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/donor/support/inquiries/${r.id}`}
                className="flex items-center gap-4 px-5 py-4 no-underline hover:bg-[var(--surface-2)] transition-colors"
              >
                <span className={`shrink-0 text-xs font-medium ${STATUS_CLASS[r.status] ?? "text-[var(--muted-foreground)]"}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
                <span className="flex-1 min-w-0 text-sm text-[var(--text)] truncate">
                  {r.subject}
                </span>
                <time className="shrink-0 text-xs text-[var(--muted-foreground)]">
                  {formatDate(r.created_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
