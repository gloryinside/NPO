import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "사업/프로그램" };

const STATUS_LABEL: Record<string, string> = {
  planning: "계획",
  active: "진행중",
  closed: "종료",
  cancelled: "취소",
};

type Row = {
  id: string;
  name: string;
  code: string | null;
  fiscal_year: number;
  budget_total: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export default async function ProgramsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const year = Number(sp.year ?? new Date().getFullYear());

  const supabase = createSupabaseAdminClient();
  const { data: programs } = await supabase
    .from("programs")
    .select("id, name, code, fiscal_year, budget_total, status, start_date, end_date")
    .eq("org_id", tenant.id)
    .eq("fiscal_year", year)
    .order("name");

  const ids = ((programs as Row[]) ?? []).map((p) => p.id);
  const spentMap = new Map<string, number>();
  if (ids.length > 0) {
    const { data: exp } = await supabase
      .from("program_expenses")
      .select("program_id, amount")
      .eq("org_id", tenant.id)
      .in("program_id", ids);
    for (const e of (exp ?? []) as Array<{ program_id: string; amount: number | null }>) {
      spentMap.set(e.program_id, (spentMap.get(e.program_id) ?? 0) + Number(e.amount ?? 0));
    }
  }

  const rows = ((programs as Row[]) ?? []).map((p) => ({
    ...p,
    spent: spentMap.get(p.id) ?? 0,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`사업/프로그램 (${year}년도)`}
        description="사업별 예산-집행 관리. 캠페인 모금액과 분리되어 회계 단위로 관리됩니다."
      />

      <div className="flex gap-2 text-sm">
        {[year - 1, year, year + 1].map((y) => (
          <Link key={y} href={`/admin/programs?year=${y}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: y === year ? "var(--accent)" : "var(--surface)",
              color: y === year ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)",
              textDecoration: "none",
            }}>
            {y}년도
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <div className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              등록된 사업이 없습니다.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["사업명", "코드", "예산", "집행", "잔액", "집행률", "상태"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const remaining = Number(p.budget_total) - p.spent;
                    const pct = p.budget_total > 0 ? (p.spent / Number(p.budget_total)) * 100 : 0;
                    return (
                      <tr key={p.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2.5 text-sm">
                          <Link href={`/admin/programs/${p.id}`}
                            style={{ color: "var(--accent)", textDecoration: "none" }}>
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{p.code ?? "-"}</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(Number(p.budget_total))}</td>
                        <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(p.spent)}</td>
                        <td className="px-3 py-2.5 text-sm font-medium"
                          style={{ color: remaining < 0 ? "var(--negative)" : "var(--text)" }}>
                          {formatKRW(remaining)}
                        </td>
                        <td className="px-3 py-2.5 text-xs"
                          style={{ color: pct > 90 ? "var(--negative)" : pct > 70 ? "var(--warning)" : "var(--muted-foreground)" }}>
                          {pct.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                          {STATUS_LABEL[p.status] ?? p.status}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 사업 등록</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/programs"
              fields={[
                { name: "name", label: "사업명", required: true },
                { name: "code", label: "회계 코드", placeholder: "PRG-2026-001" },
                { name: "fiscalYear", label: "회계연도", type: "number", required: true, defaultValue: year },
                { name: "budgetTotal", label: "예산 총액(원)", type: "number", min: 0 },
                {
                  name: "status", label: "상태", type: "select",
                  defaultValue: "planning",
                  options: [
                    { value: "planning", label: "계획" },
                    { value: "active", label: "진행중" },
                    { value: "closed", label: "종료" },
                    { value: "cancelled", label: "취소" },
                  ],
                },
                { name: "startDate", label: "시작일", type: "date" },
                { name: "endDate", label: "종료일", type: "date" },
                { name: "description", label: "설명", type: "textarea" },
              ]}
              submitLabel="사업 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
