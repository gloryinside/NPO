import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { JsonForm } from "@/components/admin/json-form";

export const metadata = { title: "채널 상세" };

function formatKRW(n: number): string {
  return n.toLocaleString("ko-KR") + "원";
}

export default async function ChannelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const [channelRes, settlementsRes] = await Promise.all([
    supabase.from("donation_channels").select("*").eq("id", id).eq("org_id", tenant.id).maybeSingle(),
    supabase.from("channel_settlements")
      .select("id, settlement_date, cash_amount, count_donors, collected_by, deposited_to_bank, bank_deposit_date, notes")
      .eq("org_id", tenant.id).eq("channel_id", id).order("settlement_date", { ascending: false }),
  ]);

  const channel = channelRes.data;
  if (!channel) return notFound();

  const settlements = (settlementsRes.data ?? []) as Array<{
    id: string; settlement_date: string; cash_amount: number; count_donors: number | null;
    collected_by: string | null; deposited_to_bank: boolean; bank_deposit_date: string | null;
    notes: string | null;
  }>;
  const totalCash = settlements.reduce((acc, s) => acc + Number(s.cash_amount), 0);
  const undeposited = settlements.filter((s) => !s.deposited_to_bank).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={channel.name}
        description={`${channel.code} · ${channel.channel_type} · ${channel.location ?? "위치 미지정"}`}
        stats={
          <>
            <StatCard label="총 회수액" value={formatKRW(totalCash)} />
            <StatCard label="정산 건수" value={`${settlements.length}건`} />
            <StatCard label="입금 미완료" value={`${undeposited}건`}
              tone={undeposited > 0 ? "warning" : "default"} />
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">정산 이력</h2>
          {settlements.length === 0 ? (
            <p className="text-sm text-[var(--muted-foreground)]">정산 기록이 없습니다.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
              <table className="w-full">
                <thead style={{ background: "var(--surface-2)" }}>
                  <tr>
                    {["정산일", "회수액", "기부자수", "회수자", "은행입금"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.settlement_date}</td>
                      <td className="px-3 py-2.5 text-sm font-medium" style={{ color: "var(--text)" }}>{formatKRW(Number(s.cash_amount))}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.count_donors ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{s.collected_by ?? "-"}</td>
                      <td className="px-3 py-2.5 text-xs" style={{ color: s.deposited_to_bank ? "var(--positive)" : "var(--warning)" }}>
                        {s.deposited_to_bank ? `✓ ${s.bank_deposit_date ?? ""}` : "미입금"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold text-[var(--text)]">정산 등록</h2>
          <div className="rounded-2xl border p-4"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <JsonForm
              url={`/api/admin/donation-channels/${id}/settlements`}
              fields={[
                { name: "settlementDate", label: "정산일", type: "date", required: true },
                { name: "cashAmount", label: "회수액(원)", type: "number", required: true, min: 0 },
                { name: "countDonors", label: "기부자 수(추정)", type: "number", min: 0 },
                { name: "collectedBy", label: "회수자" },
                { name: "depositedToBank", label: "은행 입금 완료", type: "checkbox" },
                { name: "bankDepositDate", label: "입금일", type: "date" },
                { name: "notes", label: "메모", type: "textarea", rows: 2 },
              ]}
              submitLabel="정산 추가"
            />
          </div>
        </section>
      </div>
    </div>
  );
}
