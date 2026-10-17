import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "지출 결의" };

const STATUS_LABEL: Record<string, string> = {
  draft: "작성중", submitted: "결재 대기", reviewed: "검토 완료",
  approved: "승인", paid: "지급", rejected: "반려",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "var(--muted-foreground)", submitted: "var(--info)", reviewed: "var(--info)",
  approved: "var(--positive)", paid: "var(--positive)", rejected: "var(--negative)",
};

type Row = {
  id: string; voucher_no: string; voucher_date: string;
  total_amount: number; vendor: string | null; description: string;
  status: string; programs: { name: string | null } | null;
};

export default async function ExpenseVouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const filter = sp.status ?? "submitted";

  const supabase = createSupabaseAdminClient();
  const [vRes, progRes] = await Promise.all([
    supabase.from("expense_vouchers")
      .select("id, voucher_no, voucher_date, total_amount, vendor, description, status, programs(name)")
      .eq("org_id", tenant.id).eq("status", filter)
      .order("voucher_date", { ascending: false }).limit(200),
    supabase.from("programs").select("id, name").eq("org_id", tenant.id).order("name"),
  ]);
  const rows = (vRes.data as unknown as Row[]) ?? [];
  const programs = ((progRes.data ?? []) as Array<{ id: string; name: string }>);

  return (
    <div className="space-y-6">
      <PageHeader title="지출 결의"
        description="품의 → 검토 → 승인 → 지급 결재 흐름. 4-eyes 원칙 (단계별 다른 admin 필요)." />

      <div className="flex gap-2 text-sm">
        {(["draft", "submitted", "reviewed", "approved", "paid", "rejected"] as const).map((s) => (
          <Link key={s} href={`/admin/expense-vouchers?status=${s}`}
            className="rounded-md px-3 py-1.5 font-medium"
            style={{
              background: filter === s ? "var(--accent)" : "var(--surface)",
              color: filter === s ? "white" : "var(--muted-foreground)",
              border: "1px solid var(--border)", textDecoration: "none",
            }}>{STATUS_LABEL[s]}</Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              해당 상태의 결의가 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["결의번호", "일자", "사업", "내용", "지급처", "금액", "상태"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{r.voucher_no}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.voucher_date}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.programs?.name ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.description}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.vendor ?? "-"}</td>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{formatKRW(Number(r.total_amount))}</td>
                      <td className="px-3 py-2.5 text-xs font-semibold" style={{ color: STATUS_COLOR[r.status] }}>
                        {STATUS_LABEL[r.status]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 결의</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/expense-vouchers"
              fields={[
                { name: "voucherDate", label: "결의일", type: "date", required: true,
                  defaultValue: new Date().toISOString().slice(0, 10) },
                { name: "totalAmount", label: "금액", type: "number", required: true, min: 0 },
                { name: "description", label: "내용", required: true },
                { name: "vendor", label: "지급처" },
                {
                  name: "programId", label: "사업", type: "select",
                  options: programs.map((p) => ({ value: p.id, label: p.name })),
                },
              ]}
              submitLabel="결의 생성 (draft)"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
