import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "은행계좌" };

const PURPOSE_LABEL: Record<string, string> = {
  main: "주거래", virtual_settlement: "가상계좌 정산",
  cms_settlement: "CMS 정산", grant: "보조금", other: "기타",
};

type Row = {
  id: string; bank_name: string; account_no: string;
  account_holder: string | null; cash_account_id: string | null;
  purpose: string | null; pg_provider: string | null; active: boolean;
  chart_of_accounts: { code: string; name: string } | null;
};

export default async function BankAccountsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const [accountsRes, coaRes] = await Promise.all([
    supabase.from("bank_accounts")
      .select("id, bank_name, account_no, account_holder, cash_account_id, purpose, pg_provider, active, chart_of_accounts:cash_account_id(code, name)")
      .eq("org_id", tenant.id).order("bank_name"),
    supabase.from("chart_of_accounts").select("id, code, name")
      .eq("org_id", tenant.id).eq("account_type", "asset").eq("active", true).order("code"),
  ]);
  const rows = (accountsRes.data as unknown as Row[]) ?? [];
  const cashAccounts = ((coaRes.data ?? []) as Array<{ id: string; code: string; name: string }>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="은행계좌"
        description="단체 보유 계좌. 가상계좌 정산 / CMS 정산 / 주거래로 분리해 회계 분개에 사용."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 계좌가 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["은행", "계좌번호", "예금주", "용도", "회계계정", "활성"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.bank_name}</td>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{r.account_no}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.account_holder ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {r.purpose ? PURPOSE_LABEL[r.purpose] : "-"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {r.chart_of_accounts ? `${r.chart_of_accounts.code} ${r.chart_of_accounts.name}` : "(미매핑)"}
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: r.active ? "var(--positive)" : "var(--muted-foreground)" }}>
                        {r.active ? "활성" : "비활성"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 계좌</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/bank-accounts"
              fields={[
                { name: "bankName", label: "은행", required: true },
                { name: "accountNo", label: "계좌번호", required: true },
                { name: "accountHolder", label: "예금주" },
                {
                  name: "purpose", label: "용도", type: "select",
                  defaultValue: "main",
                  options: Object.entries(PURPOSE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                {
                  name: "cashAccountId", label: "회계 자산계정",
                  type: "select",
                  options: cashAccounts.map((c) => ({ value: c.id, label: `${c.code} ${c.name}` })),
                },
                { name: "pgProvider", label: "PG (가상계좌일 때)", placeholder: "toss" },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="계좌 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
