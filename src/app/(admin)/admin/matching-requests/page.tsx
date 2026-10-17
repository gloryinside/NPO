import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { MatchingRequestActions } from "./matching-actions";

export const metadata = { title: "매칭 신청" };

const STATUS_LABEL: Record<string, string> = {
  pending: "검토 대기",
  approved: "승인",
  rejected: "거절",
  fulfilled: "매칭 결제 완료",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warning)",
  approved: "var(--info)",
  rejected: "var(--negative)",
  fulfilled: "var(--positive)",
};

type Row = {
  id: string;
  donor_member_id: string;
  donor_payment_id: string;
  donor_amount: number;
  requested_match_amount: number;
  status: string;
  created_at: string;
  matching_programs: { name: string | null } | null;
  members: { name: string | null } | null;
};

export default async function MatchingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "pending";

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("matching_requests")
    .select(
      "id, donor_member_id, donor_payment_id, donor_amount, requested_match_amount, status, created_at, matching_programs(name), members:donor_member_id(name)"
    )
    .eq("org_id", tenant.id)
    .eq("status", filter)
    .order("created_at", { ascending: false });

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="기업 매칭 신청"
        description="직원 매칭 신청을 검토하고, 매칭 결제 완료 시 payments와 연결합니다."
      />

      <div className="flex gap-2 text-sm">
        {(["pending", "approved", "fulfilled", "rejected"] as const).map((s) => (
          <Link key={s} href={`/admin/matching-requests?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>{STATUS_LABEL[s]}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          해당 상태의 신청이 없습니다.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-2xl border p-4"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">
                    {r.members?.name ?? "(이름 없음)"} · {r.matching_programs?.name ?? "프로그램?"}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    직원 결제 {Number(r.donor_amount).toLocaleString("ko-KR")}원
                    {" → 매칭 신청 "}
                    <b style={{ color: "var(--text)" }}>{Number(r.requested_match_amount).toLocaleString("ko-KR")}원</b>
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {new Date(r.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </div>
                <span className="text-xs font-semibold" style={{ color: STATUS_COLOR[r.status] }}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              {(r.status === "pending" || r.status === "approved") && (
                <MatchingRequestActions requestId={r.id} status={r.status} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
