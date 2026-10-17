import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";

export const metadata = { title: "정산 차이" };

const TYPE_LABEL: Record<string, string> = {
  duplicate_payment: "중복 결제 의심",
  amount_mismatch: "금액 불일치",
  missing_settlement: "정산 누락",
  unmatched_deposit: "정체불명 입금",
};
const TYPE_COLOR: Record<string, string> = {
  duplicate_payment: "var(--negative)",
  amount_mismatch: "var(--warning)",
  missing_settlement: "var(--warning)",
  unmatched_deposit: "var(--info)",
};
const STATUS_LABEL: Record<string, string> = {
  open: "확인 필요", investigating: "조사중", resolved: "해결", false_positive: "오감지",
};

type Row = {
  id: string; discrepancy_type: string; related_payment_ids: string[];
  amount_expected: number | null; amount_actual: number | null;
  detected_date: string; status: string; created_at: string;
};

export default async function SettlementDiscrepanciesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "open";

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("settlement_discrepancies")
    .select("id, discrepancy_type, related_payment_ids, amount_expected, amount_actual, detected_date, status, created_at")
    .eq("org_id", tenant.id).eq("status", filter)
    .order("detected_date", { ascending: false }).limit(200);
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="정산 금액 차이 확인"
        description="중복결제·정산 누락·정체불명 입금 등 사고 위험을 매일 자동 감지합니다." />

      <div className="flex gap-2 text-sm">
        {(["open", "investigating", "resolved", "false_positive"] as const).map((s) => (
          <Link key={s} href={`/admin/settlement-discrepancies?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>{STATUS_LABEL[s]}</Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          이상 없음.
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>{["감지일", "유형", "관련 결제", "예상", "실제", "상태"].map((h) =>
                <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                  style={{ color: "var(--muted-foreground)" }}>{h}</th>
              )}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.detected_date}</td>
                  <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: TYPE_COLOR[r.discrepancy_type] }}>
                    {TYPE_LABEL[r.discrepancy_type] ?? r.discrepancy_type}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
                    {r.related_payment_ids?.slice(0, 2).map((id) => id.slice(0, 8)).join(", ")}
                    {r.related_payment_ids?.length > 2 && ` +${r.related_payment_ids.length - 2}`}
                  </td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                    {r.amount_expected != null ? Number(r.amount_expected).toLocaleString("ko-KR") + "원" : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                    {r.amount_actual != null ? Number(r.amount_actual).toLocaleString("ko-KR") + "원" : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
