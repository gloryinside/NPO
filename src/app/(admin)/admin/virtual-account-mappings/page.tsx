import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "가상계좌 매핑" };

type Row = {
  id: string; virtual_account_pattern: string | null; pg_method: string | null;
  bank_account_id: string; priority: number; active: boolean;
  bank_accounts: { bank_name: string; account_no: string } | null;
};

export default async function VirtualAccountMappingsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const [mapsRes, banksRes] = await Promise.all([
    supabase.from("virtual_account_mappings")
      .select("id, virtual_account_pattern, pg_method, bank_account_id, priority, active, bank_accounts(bank_name, account_no)")
      .eq("org_id", tenant.id).order("priority"),
    supabase.from("bank_accounts").select("id, bank_name, account_no")
      .eq("org_id", tenant.id).eq("active", true).order("bank_name"),
  ]);
  const rows = (mapsRes.data as unknown as Row[]) ?? [];
  const banks = ((banksRes.data ?? []) as Array<{ id: string; bank_name: string; account_no: string }>);

  return (
    <div className="space-y-6">
      <PageHeader
        title="가상계좌 매핑"
        description="결제 시 자동으로 어느 자체 계좌에 입금됐는지 매핑. 회계 분개 차변 자동 계산에 사용."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              매핑이 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["우선순위", "PG method", "패턴", "→ 계좌", "활성"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.priority}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.pg_method ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{r.virtual_account_pattern ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                        {r.bank_accounts ? `${r.bank_accounts.bank_name} ${r.bank_accounts.account_no}` : "-"}
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
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 매핑</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/virtual-account-mappings"
              fields={[
                {
                  name: "bankAccountId", label: "입금될 계좌", type: "select", required: true,
                  options: banks.map((b) => ({ value: b.id, label: `${b.bank_name} ${b.account_no}` })),
                },
                { name: "pgMethod", label: "PG method", placeholder: "CARD / VIRTUAL_ACCOUNT / TRANSFER" },
                { name: "virtualAccountPattern", label: "가상계좌 패턴",
                  helpText: "특정 패턴만 매칭 (생략 가능)" },
                { name: "priority", label: "우선순위 (낮을수록 우선)", type: "number", defaultValue: 100 },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="매핑 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
