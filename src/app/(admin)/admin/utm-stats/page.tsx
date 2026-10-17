import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/common/page-header";
import { formatKRW } from "@/lib/format";

export const metadata = { title: "UTM 분석" };

export default async function UtmStatsPage({
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
  const { data } = await supabase
    .from("payments")
    .select("amount, member_id, utm_source, utm_medium, utm_campaign")
    .eq("org_id", tenant.id).eq("pay_status", "paid")
    .gte("pay_date", from).lte("pay_date", to);

  type Row = { amount: number; member_id: string; utm_source: string | null; utm_medium: string | null; utm_campaign: string | null };
  const rows = (data ?? []) as Row[];

  const groups = {
    source: new Map<string, { sum: number; count: number; donors: Set<string> }>(),
    medium: new Map<string, { sum: number; count: number; donors: Set<string> }>(),
    campaign: new Map<string, { sum: number; count: number; donors: Set<string> }>(),
  };
  const upsert = (m: typeof groups.source, k: string, a: number, mid: string) => {
    const cur = m.get(k) ?? { sum: 0, count: 0, donors: new Set() };
    cur.sum += a; cur.count++; cur.donors.add(mid);
    m.set(k, cur);
  };
  for (const r of rows) {
    const a = Number(r.amount);
    upsert(groups.source, r.utm_source ?? "(direct)", a, r.member_id);
    upsert(groups.medium, r.utm_medium ?? "(none)", a, r.member_id);
    upsert(groups.campaign, r.utm_campaign ?? "(none)", a, r.member_id);
  }
  const toArr = (m: typeof groups.source) => Array.from(m, ([key, v]) => ({
    key, sum: v.sum, count: v.count, donors: v.donors.size,
  })).sort((a, b) => b.sum - a.sum);

  return (
    <div className="space-y-6">
      <PageHeader title="유입 경로 분석" description={`${from} ~ ${to} 기간의 채널/캠페인 효과`} />

      <form className="flex items-end gap-3 text-sm" action="/admin/utm-stats">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">시작</span>
          <input type="date" name="from" defaultValue={from}
            className="rounded-md border bg-[var(--surface)] px-3 py-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted-foreground)]">종료</span>
          <input type="date" name="to" defaultValue={to}
            className="rounded-md border bg-[var(--surface)] px-3 py-2"
            style={{ borderColor: "var(--border)", color: "var(--text)" }} />
        </label>
        <button type="submit" className="rounded-md px-4 py-2 font-semibold text-white"
          style={{ background: "var(--accent)" }}>조회</button>
      </form>

      {(["source", "medium", "campaign"] as const).map((g) => {
        const arr = toArr(groups[g]);
        return (
          <section key={g}>
            <h2 className="mb-2 text-sm font-semibold text-[var(--text)]">
              UTM {g === "source" ? "소스" : g === "medium" ? "매체" : "캠페인"}별
            </h2>
            {arr.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">데이터 없음</p>
            ) : (
              <div className="overflow-hidden rounded-2xl border" style={{ borderColor: "var(--border)" }}>
                <table className="w-full">
                  <thead style={{ background: "var(--surface-2)" }}>
                    <tr>{[g, "건수", "고유 후원자", "총액"].map((h) =>
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase"
                        style={{ color: "var(--muted-foreground)" }}>{h}</th>
                    )}</tr>
                  </thead>
                  <tbody>
                    {arr.map((it) => (
                      <tr key={it.key} style={{ borderTop: "1px solid var(--border)" }}>
                        <td className="px-3 py-2 text-sm" style={{ color: "var(--text)" }}>{it.key}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{it.count}</td>
                        <td className="px-3 py-2 text-xs" style={{ color: "var(--muted-foreground)" }}>{it.donors}</td>
                        <td className="px-3 py-2 text-sm font-medium" style={{ color: "var(--text)" }}>{formatKRW(it.sum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
