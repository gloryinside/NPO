import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BankImportForm } from "@/components/admin/bank-import-form";

export const metadata = { title: "은행 입금 대사" };

export default async function AdminBankPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: unmatched } = await supabase
    .from("bank_statements")
    .select("id, statement_date, counterparty, amount, memo, bank_ref")
    .eq("org_id", tenant.id)
    .is("matched_at", null)
    .gt("amount", 0)
    .order("statement_date", { ascending: false })
    .limit(200);

  const rows = (unmatched ?? []) as Array<{
    id: string;
    statement_date: string;
    counterparty: string | null;
    amount: number;
    memo: string | null;
    bank_ref: string | null;
  }>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">은행 입금 대사</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          은행 CSV 를 업로드하면 자동 매칭되며, 미매칭 건은 아래에서 수동 확인합니다.
        </p>
      </div>

      <section
        className="rounded-2xl border p-5"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <BankImportForm />
      </section>

      <section>
        <h2
          className="mb-3 text-base font-semibold"
          style={{ color: "var(--text)" }}
        >
          미매칭 입금 ({rows.length}건)
        </h2>
        {rows.length === 0 ? (
          <div
            className="rounded-2xl border py-12 text-center text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--surface)",
              color: "var(--muted-foreground)",
            }}
          >
            매칭되지 않은 입금이 없습니다.
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
                  {["날짜", "이체인", "금액", "메모", "거래번호"].map((h) => (
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
                      {r.statement_date}
                    </td>
                    <td
                      className="px-4 py-3 text-sm"
                      style={{ color: "var(--text)" }}
                    >
                      {r.counterparty ?? "-"}
                    </td>
                    <td
                      className="px-4 py-3 text-sm font-semibold"
                      style={{ color: "var(--accent)" }}
                    >
                      {r.amount.toLocaleString("ko-KR")}원
                    </td>
                    <td
                      className="px-4 py-3 text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {r.memo ?? "-"}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {r.bank_ref ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
