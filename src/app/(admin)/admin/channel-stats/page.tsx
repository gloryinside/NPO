import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "채널별 통계" };

const TYPE_LABEL: Record<string, string> = {
  box: "모금함", street: "거리모금", booth: "부스",
  online: "온라인", partner: "파트너", other: "기타",
};

export default async function ChannelStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const sp = await searchParams;
  const from = sp.from ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.to ?? new Date().toISOString().slice(0, 10);

  const supabase = createSupabaseAdminClient();
  const [paysRes, settlementsRes, channelsRes] = await Promise.all([
    supabase.from("payments").select("channel_id, amount")
      .eq("org_id", tenant.id).eq("pay_status", "paid")
      .gte("pay_date", from).lte("pay_date", to),
    supabase.from("channel_settlements").select("channel_id, cash_amount")
      .eq("org_id", tenant.id)
      .gte("settlement_date", from).lte("settlement_date", to),
    supabase.from("donation_channels").select("id, code, name, channel_type")
      .eq("org_id", tenant.id),
  ]);

  type Sums = { paymentSum: number; settlementSum: number };
  const byChannel = new Map<string, Sums>();
  const upsertCh = (id: string, key: keyof Sums, amt: number) => {
    const cur = byChannel.get(id) ?? { paymentSum: 0, settlementSum: 0 };
    cur[key] += amt;
    byChannel.set(id, cur);
  };
  for (const p of (paysRes.data ?? []) as Array<{ channel_id: string | null; amount: number | null }>) {
    upsertCh(p.channel_id ?? "unassigned", "paymentSum", Number(p.amount ?? 0));
  }
  for (const s of (settlementsRes.data ?? []) as Array<{ channel_id: string; cash_amount: number | null }>) {
    upsertCh(s.channel_id, "settlementSum", Number(s.cash_amount ?? 0));
  }

  const channelMap = new Map(((channelsRes.data ?? []) as Array<{
    id: string; code: string; name: string; channel_type: string;
  }>).map((c) => [c.id, c]));

  const items = Array.from(byChannel.entries()).map(([id, sums]) => {
    const ch = channelMap.get(id);
    return {
      id, code: ch?.code ?? null,
      name: ch?.name ?? (id === "unassigned" ? "(미지정)" : id),
      channelType: ch?.channel_type ?? null,
      ...sums,
      total: sums.paymentSum + sums.settlementSum,
    };
  }).sort((a, b) => b.total - a.total);

  const grandTotal = items.reduce((acc, i) => acc + i.total, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="채널별 모금 통계"
        description={`${from} ~ ${to} 기간의 채널별 모금 합계`}
        stats={
          <>
            <StatCard label="기간 총 모금" value={formatKRW(grandTotal)} />
            <StatCard label="활성 채널" value={`${items.length}개`} />
          </>
        }
      />

      <form className="flex flex-wrap items-end gap-3 text-sm" action="/admin/channel-stats">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">시작일</span>
          <input type="date" name="from" defaultValue={from}
            className="rounded-md border bg-[var(--surface)] px-3 py-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">종료일</span>
          <input type="date" name="to" defaultValue={to}
            className="rounded-md border bg-[var(--surface)] px-3 py-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
        </label>
        <button type="submit"
          className="rounded-md px-4 py-2 font-semibold text-white"
          style={{ background: "var(--accent)" }}>
          조회
        </button>
      </form>

      {items.length === 0 ? (
        <div className="rounded-2xl border py-10 text-center text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--muted-foreground)" }}>
          기간 내 모금이 없습니다.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
          <table className="w-full">
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                {["채널", "유형", "온라인 결제", "현금 회수", "합계", "비중"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase"
                    style={{ color: "var(--muted-foreground)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const pct = grandTotal > 0 ? (it.total / grandTotal) * 100 : 0;
                return (
                  <tr key={it.id} style={{ borderTop: "1px solid var(--border)" }}>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>
                      {it.name}
                      {it.code && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{it.code}</span>}
                    </td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      {it.channelType ? (TYPE_LABEL[it.channelType] ?? it.channelType) : "-"}
                    </td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(it.paymentSum)}</td>
                    <td className="px-3 py-2.5 text-sm" style={{ color: "var(--text)" }}>{formatKRW(it.settlementSum)}</td>
                    <td className="px-3 py-2.5 text-sm font-semibold" style={{ color: "var(--text)" }}>{formatKRW(it.total)}</td>
                    <td className="px-3 py-2.5 text-xs" style={{ color: "var(--muted-foreground)" }}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
