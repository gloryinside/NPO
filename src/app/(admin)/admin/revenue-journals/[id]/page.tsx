import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { JsonPostButton } from "@/components/admin/json-post-button";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "수입결의 상세" };

export default async function RevenueJournalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const [jRes, lRes] = await Promise.all([
    supabase.from("revenue_journals").select("*")
      .eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("revenue_journal_lines")
      .select("payment_id, amount, debit_account_id, credit_account_id, bp_code, debit:debit_account_id(code, name), credit:credit_account_id(code, name), payments(payment_code, members(member_code, name))")
      .eq("journal_id", id).eq("org_id", tenant.id),
  ]);
  const journal = jRes.data;
  if (!journal) return notFound();

  type Line = {
    payment_id: string; amount: number; bp_code: string | null;
    debit: { code: string; name: string } | null;
    credit: { code: string; name: string } | null;
    payments: { payment_code: string; members: { member_code: string | null; name: string } | null } | null;
  };
  const lines = (lRes.data as unknown as Line[]) ?? [];
  const totalDr = lines.reduce((a, l) => a + Number(l.amount), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`결의 ${journal.journal_no}`}
        description={`${journal.journal_date} · ${journal.status} ${journal.external_voucher_no ? `· 전표 ${journal.external_voucher_no}` : ""}`}
        stats={
          <>
            <StatCard label="총액" value={formatKRW(Number(journal.total_amount))} />
            <StatCard label="라인" value={`${journal.payment_count}건`} />
            <StatCard label="차변 합계" value={formatKRW(totalDr)} />
          </>
        }
        actions={
          <div className="flex gap-2">
            {journal.status === "draft" && (
              <JsonPostButton
                url={`/api/admin/revenue-journals/${id}/approve`}
                label="승인"
                variant="primary"
                confirm="결의를 승인합니다. 다른 admin이 작성한 건만 승인 가능."
              />
            )}
            {journal.status === "approved" && (
              <JsonPostButton
                url={`/api/admin/revenue-journals/${id}/post`}
                label="ERP 전송"
                variant="primary"
                confirm="ERP 큐에 적재합니다."
              />
            )}
          </div>
        }
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">결의 라인</h2>
        {lines.length === 0 ? (
          <p className="text-sm text-[var(--muted-foreground)]">라인이 없습니다.</p>
        ) : (
          <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full">
              <thead style={{ background: "var(--surface-2)" }}>
                <tr>{["결제번호", "후원자(거래처)", "차변계정", "대변계정", "금액"].map((h) =>
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                    style={{ color: "var(--muted-foreground)" }}>{h}</th>
                )}</tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.payment_id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-2.5 text-xs font-mono" style={{ color: "var(--muted-foreground)" }}>
                      {l.payments?.payment_code}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {l.payments?.members?.name}
                      {l.bp_code && <span className="ml-2 font-mono">({l.bp_code})</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {l.debit ? `${l.debit.code} ${l.debit.name}` : "(미설정)"}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {l.credit ? `${l.credit.code} ${l.credit.name}` : "(미설정)"}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>
                      {formatKRW(Number(l.amount))}
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
