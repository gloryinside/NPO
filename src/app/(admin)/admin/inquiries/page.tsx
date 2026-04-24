import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "문의 관리" };

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
const CATEGORY_LABEL: Record<string, string> = {
  general: "일반",
  payment: "결제",
  receipt: "영수증",
  donation: "후원",
  other: "기타",
};

type Row = {
  id: string;
  category: string;
  subject: string;
  status: string;
  created_at: string;
  answered_at: string | null;
  members: { name: string | null; email: string | null } | null;
};

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("ko-KR"); } catch { return iso; }
}

export default async function AdminInquiriesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const admin = createSupabaseAdminClient();

  const [openRes, allRes] = await Promise.all([
    admin
      .from("inquiries")
      .select("id, category, subject, status, created_at, answered_at, members(name, email)")
      .eq("org_id", tenant.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200),
    admin
      .from("inquiries")
      .select("id, category, subject, status, created_at, answered_at, members(name, email)")
      .eq("org_id", tenant.id)
      .in("status", ["answered", "closed"])
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const openRows = (openRes.data as unknown as Row[]) ?? [];
  const answeredRows = (allRes.data as unknown as Row[]) ?? [];

  function InquiryTable({ rows, emptyMsg }: { rows: Row[]; emptyMsg: string }) {
    if (rows.length === 0) {
      return (
        <div className="rounded-lg border border-dashed py-10 text-center border-[var(--border)] text-[var(--muted-foreground)] text-sm">
          {emptyMsg}
        </div>
      );
    }
    return (
      <div className="rounded-lg border overflow-hidden border-[var(--border)] bg-[var(--surface)]">
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/inquiries/${r.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--surface-2)] transition-colors no-underline"
              >
                <Badge className={`border-0 bg-[var(--surface-2)] shrink-0 ${STATUS_COLOR[r.status]}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </Badge>
                <Badge className="border-0 bg-[var(--surface-2)] text-[var(--muted-foreground)] shrink-0 text-xs">
                  {CATEGORY_LABEL[r.category] ?? r.category}
                </Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--text)] truncate">{r.subject}</p>
                  <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                    {r.members?.name ?? "(알 수 없음)"} · {r.members?.email ?? ""}
                  </p>
                </div>
                <time className="text-xs text-[var(--muted-foreground)] shrink-0">
                  {formatDate(r.created_at)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">문의 관리</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          후원자 문의에 답변하고 상태를 관리합니다.
        </p>
      </div>

      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3">
          답변 대기 <span className="text-[var(--warning)]">({openRows.length})</span>
        </h2>
        <InquiryTable rows={openRows} emptyMsg="답변 대기 중인 문의가 없습니다." />
      </section>

      <section>
        <h2 className="text-base font-semibold text-[var(--text)] mb-3">
          처리 완료 ({answeredRows.length})
        </h2>
        <InquiryTable rows={answeredRows} emptyMsg="처리 완료된 문의가 없습니다." />
      </section>
    </div>
  );
}
