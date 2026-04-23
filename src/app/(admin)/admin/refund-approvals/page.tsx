import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "환불 승인" };

const STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  approved: "승인",
  rejected: "반려",
  executed: "실행완료",
  failed: "실패",
};
const STATUS_COLOR: Record<string, string> = {
  pending: "var(--warning)",
  approved: "var(--positive)",
  rejected: "var(--negative)",
  executed: "var(--info)",
  failed: "var(--negative)",
};

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}
function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

type Row = {
  id: string;
  payment_id: string;
  requested_by_email: string | null;
  amount: number;
  reason: string | null;
  status: string;
  approved_by_email: string | null;
  rejected_reason: string | null;
  executed_at: string | null;
  created_at: string;
  payments:
    | { payment_code: string | null; members: { name: string | null } | null }
    | null;
};

export default async function AdminRefundApprovalsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("refund_approvals")
    .select(
      "id, payment_id, requested_by_email, amount, reason, status, approved_by_email, rejected_reason, executed_at, created_at, payments(payment_code, members(name))"
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">환불 승인 요청</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          요청자와 다른 관리자가 승인한 건만 실제 환불이 실행됩니다.
        </p>
      </div>

      {rows.length === 0 ? (
        <div
          className="rounded-2xl border py-12 text-center text-sm"
          style={{
            borderColor: "var(--border)",
            background: "var(--surface)",
            color: "var(--muted-foreground)",
          }}
        >
          환불 요청이 없습니다.
        </div>
      ) : (
        <div
          className="overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <table className="w-full">
            <thead
              style={{
                background: "var(--surface-2)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <tr>
                {[
                  "요청일",
                  "결제",
                  "회원",
                  "금액",
                  "상태",
                  "요청자",
                  "승인자",
                  "사유",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {formatDate(r.created_at)}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {r.payments?.payment_code ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--text)" }}
                  >
                    {r.payments?.members?.name ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    {formatKRW(r.amount)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    <span style={{ color: STATUS_COLOR[r.status] ?? "var(--text)" }}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.requested_by_email ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.approved_by_email ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.rejected_reason ?? r.reason ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
