import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "결산 보고서" };

const TYPE_LABEL: Record<string, string> = {
  income_expense: "수지보고서", balance_sheet: "대차대조표",
  cash_flow: "현금흐름표", custom: "기타",
};

type Row = {
  id: string; fiscal_year: number; report_type: string;
  period_start: string; period_end: string;
  status: string; generated_at: string;
};

export default async function FiscalReportsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("fiscal_reports")
    .select("id, fiscal_year, report_type, period_start, period_end, status, generated_at")
    .eq("org_id", tenant.id).order("fiscal_year", { ascending: false });
  const rows = (data as Row[]) ?? [];
  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <PageHeader title="결산 보고서"
        description="수지/대차/현금흐름 등 회계 보고서. payments + expense_vouchers 자동 집계." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              생성된 보고서가 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["연도", "유형", "기간", "상태", "생성"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.fiscal_year}년</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{TYPE_LABEL[r.report_type]}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.period_start} ~ {r.period_end}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.status}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {new Date(r.generated_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 보고서 생성</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/fiscal-reports"
              fields={[
                { name: "fiscalYear", label: "회계연도", type: "number", required: true, defaultValue: thisYear },
                {
                  name: "reportType", label: "보고서 유형", type: "select", required: true,
                  defaultValue: "income_expense",
                  options: Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l })),
                },
                { name: "periodStart", label: "시작일", type: "date" },
                { name: "periodEnd", label: "종료일", type: "date" },
              ]}
              submitLabel="자동 집계 생성"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
