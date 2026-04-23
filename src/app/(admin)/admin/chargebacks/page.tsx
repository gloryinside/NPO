import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "카드 분쟁(Chargeback)" };

const STATUS_LABEL: Record<string, string> = {
  open: "분쟁접수",
  evidence_submitted: "증빙제출",
  won: "승소",
  lost: "패소",
  closed: "종료",
};

function formatKRW(n: number) {
  return `${n.toLocaleString("ko-KR")}원`;
}
function formatDate(iso: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return iso;
  }
}

type Row = {
  id: string;
  payment_id: string;
  amount: number;
  reason_code: string | null;
  reason_text: string | null;
  status: string;
  toss_case_id: string | null;
  created_at: string;
  closed_at: string | null;
  payments:
    | {
        payment_code: string | null;
        members: { name: string | null; member_code: string | null } | null;
      }
    | null;
};

export default async function AdminChargebacksPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("chargebacks")
    .select(
      "id, payment_id, amount, reason_code, reason_text, status, toss_case_id, created_at, closed_at, payments(payment_code, members(name, member_code))"
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">카드 분쟁</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          Toss 에서 전달된 카드 분쟁(chargeback) 케이스 이력. 회원에 자동으로 위험 플래그가 부여됩니다.
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
          접수된 분쟁이 없습니다.
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
                {["접수일", "회원", "결제", "금액", "사유", "상태", "Case ID"].map(
                  (h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {h}
                    </th>
                  )
                )}
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
                    className="px-4 py-3 text-sm"
                    style={{ color: "var(--text)" }}
                  >
                    {r.payments?.members?.name ?? "-"}
                    <span
                      className="ml-1 font-mono text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {r.payments?.members?.member_code ?? ""}
                    </span>
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--text)" }}
                  >
                    {r.payments?.payment_code ?? "-"}
                  </td>
                  <td
                    className="px-4 py-3 text-sm font-semibold"
                    style={{ color: "var(--negative)" }}
                  >
                    {formatKRW(r.amount)}
                  </td>
                  <td
                    className="px-4 py-3 text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.reason_text ?? r.reason_code ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </td>
                  <td
                    className="px-4 py-3 font-mono text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {r.toss_case_id ?? "-"}
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
