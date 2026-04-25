import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "사업 상세" };

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export default async function ProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [progRes, itemsRes, expRes] = await Promise.all([
    supabase.from("programs").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("program_budget_items").select("id, category, item_name, budget_amount").eq("org_id", tenant.id).eq("program_id", id).order("category"),
    supabase.from("program_expenses").select("id, expense_date, amount, description, vendor, budget_item_id").eq("org_id", tenant.id).eq("program_id", id).order("expense_date", { ascending: false }).limit(200),
  ]);

  const program = progRes.data;
  if (!program) return notFound();

  const items = (itemsRes.data ?? []) as Array<{ id: string; category: string; item_name: string; budget_amount: number }>;
  const expenses = (expRes.data ?? []) as Array<{ id: string; expense_date: string; amount: number; description: string; vendor: string | null; budget_item_id: string | null }>;

  const spentByItem = new Map<string, number>();
  for (const e of expenses) {
    if (e.budget_item_id) {
      spentByItem.set(e.budget_item_id, (spentByItem.get(e.budget_item_id) ?? 0) + Number(e.amount));
    }
  }
  const totalSpent = expenses.reduce((acc, e) => acc + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`사업 — ${program.name}`}
        description={program.description ?? undefined}
        stats={
          <>
            <StatCard label="예산" value={formatKRW(Number(program.budget_total))} />
            <StatCard label="집행" value={formatKRW(totalSpent)} />
            <StatCard label="잔액" value={formatKRW(Number(program.budget_total) - totalSpent)}
              tone={Number(program.budget_total) - totalSpent < 0 ? "negative" : "default"} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">예산 항목</h2>
          {items.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">아직 예산 항목이 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["카테고리", "항목", "예산", "집행", "잔액"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const spent = spentByItem.get(it.id) ?? 0;
                    return (
                      <tr key={it.id} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{it.category}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text)" }}>{it.item_name}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text)" }}>{formatKRW(Number(it.budget_amount))}</td>
                        <td className="px-3 py-2" style={{ color: "var(--text)" }}>{formatKRW(spent)}</td>
                        <td className="px-3 py-2 font-medium"
                          style={{ color: Number(it.budget_amount) - spent < 0 ? "var(--negative)" : "var(--text)" }}>
                          {formatKRW(Number(it.budget_amount) - spent)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">예산 항목 추가</h3>
            <JsonForm
              url={`/api/admin/programs/${id}/budget-items`}
              fields={[
                { name: "category", label: "카테고리", required: true, placeholder: "인건비/사업비/관리비/시설비" },
                { name: "itemName", label: "항목명", required: true },
                { name: "budgetAmount", label: "예산(원)", type: "number", required: true, min: 0 },
                { name: "notes", label: "비고", type: "textarea", rows: 2 },
              ]}
              submitLabel="항목 추가"
            />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">집행 내역</h2>
          {expenses.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">집행 내역이 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full text-sm">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["일자", "내용", "지급처", "금액"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{e.expense_date}</td>
                      <td className="px-3 py-2" style={{ color: "var(--text)" }}>{e.description}</td>
                      <td className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{e.vendor ?? "-"}</td>
                      <td className="px-3 py-2 font-medium" style={{ color: "var(--text)" }}>{formatKRW(Number(e.amount))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <h3 className="mb-2 text-sm font-semibold text-[var(--text)]">집행 등록</h3>
            <JsonForm
              url={`/api/admin/programs/${id}/expenses`}
              fields={[
                { name: "expenseDate", label: "집행일", type: "date", required: true },
                { name: "amount", label: "금액(원)", type: "number", required: true, min: 0 },
                { name: "description", label: "내용", required: true },
                { name: "vendor", label: "지급처" },
                {
                  name: "budgetItemId", label: "예산 항목", type: "select",
                  options: items.map((it) => ({ value: it.id, label: `${it.category} / ${it.item_name}` })),
                },
                { name: "receiptUrl", label: "영수증 URL" },
              ]}
              submitLabel="집행 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
