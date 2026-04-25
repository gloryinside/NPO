import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "계정과목" };

const TYPE_LABEL: Record<string, string> = {
  asset: "자산", liability: "부채", equity: "자본",
  revenue: "수익", expense: "비용",
};
const KIND_LABEL: Record<string, string> = {
  designated: "지정기부금", non_designated: "비지정기부금",
  government: "국고보조", other: "기타",
};

type Row = {
  id: string; code: string; name: string;
  account_type: string; donation_kind: string | null;
  parent_id: string | null; active: boolean;
};

export default async function ChartOfAccountsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("chart_of_accounts")
    .select("id, code, name, account_type, donation_kind, parent_id, active")
    .eq("org_id", tenant.id).order("code");
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="계정과목"
        description="ERP 회계 분개에 쓸 계정과목 마스터. 캠페인/은행계좌가 이 코드를 참조합니다."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              계정과목이 등록되지 않았습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["코드", "이름", "분류", "기부종류", "활성"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{r.code}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.name}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[r.account_type]}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {r.donation_kind ? KIND_LABEL[r.donation_kind] : "-"}
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
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 계정과목</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/chart-of-accounts"
              fields={[
                { name: "code", label: "코드", required: true, placeholder: "4111" },
                { name: "name", label: "이름", required: true, placeholder: "지정기부금수익" },
                {
                  name: "accountType", label: "분류", type: "select", required: true,
                  options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                {
                  name: "donationKind", label: "기부 종류 (수익 한정)", type: "select",
                  options: Object.entries(KIND_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "active", label: "활성", type: "checkbox", defaultValue: true },
              ]}
              submitLabel="계정과목 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
