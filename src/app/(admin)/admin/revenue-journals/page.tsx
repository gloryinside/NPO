import Link from "next/link";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { JsonForm } from "@/components/admin/json-form";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "수입결의" };

const STATUS_LABEL: Record<string, string> = {
  draft: "작성", approved: "승인", posted: "ERP 전송", cancelled: "취소",
};

type Row = {
  id: string; journal_no: string; journal_date: string; description: string | null;
  total_amount: number; payment_count: number; status: string;
  posted_to_erp_at: string | null; external_voucher_no: string | null;
};

export default async function RevenueJournalsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("revenue_journals")
    .select("id, journal_no, journal_date, description, total_amount, payment_count, status, posted_to_erp_at, external_voucher_no")
    .eq("org_id", tenant.id).order("journal_date", { ascending: false }).limit(200);
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="수입 전표"
        description="confirmed payments을 묶어 결의 1건 생성. draft → approved → posted (ERP 전송)."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          {rows.length === 0 ? (
            <p className="rounded-2xl border py-10 text-center text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
              결의가 없습니다.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>{["결의번호", "결의일", "건수", "총액", "상태", "ERP 전표번호"].map((h) =>
                    <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                      style={{ color: "var(--muted-foreground)" }}>{h}</th>
                  )}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-sm">
                        <Link href={`/admin/revenue-journals/${r.id}`}
                          style={{ color: "var(--accent)", textDecoration: "none" }}>{r.journal_no}</Link>
                      </td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{r.journal_date}</td>
                      <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{r.payment_count}건</td>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{formatKRW(Number(r.total_amount))}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{STATUS_LABEL[r.status]}</td>
                      <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>{r.external_voucher_no ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">새 결의 생성</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url="/api/admin/revenue-journals"
              fields={[
                { name: "journalDate", label: "결의일", type: "date", required: true,
                  defaultValue: new Date().toISOString().slice(0, 10) },
                { name: "periodStart", label: "포함 시작일", type: "date",
                  helpText: "비우면 결의일 당일만" },
                { name: "periodEnd", label: "포함 종료일", type: "date" },
                { name: "description", label: "설명", placeholder: "2026-04 1차 수입결의" },
              ]}
              submitLabel="결의 생성"
              successMessage="생성됨"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
