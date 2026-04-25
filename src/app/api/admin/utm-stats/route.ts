import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/utm-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   UTM별 모금액 + 신규 후원자 수 + ROAS (마케팅 지출과 결합).
 *   source/medium/campaign 별 그룹.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from") ?? `${new Date().getFullYear()}-01-01`;
  const to = sp.get("to") ?? new Date().toISOString().slice(0, 10);

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("payments")
    .select("amount, member_id, utm_source, utm_medium, utm_campaign, pay_date")
    .eq("org_id", tenant.id)
    .eq("pay_status", "paid")
    .gte("pay_date", from)
    .lte("pay_date", to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { amount: number; member_id: string; utm_source: string | null;
    utm_medium: string | null; utm_campaign: string | null };
  const rows = (data ?? []) as Row[];

  // 그룹별 집계
  const bySource = new Map<string, { sum: number; count: number; donors: Set<string> }>();
  const byCampaign = new Map<string, { sum: number; count: number; donors: Set<string> }>();
  const byMedium = new Map<string, { sum: number; count: number; donors: Set<string> }>();

  const upsert = (m: typeof bySource, key: string, amt: number, mid: string) => {
    const cur = m.get(key) ?? { sum: 0, count: 0, donors: new Set() };
    cur.sum += amt; cur.count++; cur.donors.add(mid);
    m.set(key, cur);
  };

  for (const r of rows) {
    const a = Number(r.amount);
    upsert(bySource, r.utm_source ?? "(direct)", a, r.member_id);
    upsert(byCampaign, r.utm_campaign ?? "(none)", a, r.member_id);
    upsert(byMedium, r.utm_medium ?? "(none)", a, r.member_id);
  }

  // 마케팅 지출과 결합 (org_marketing_spend가 있는 경우)
  const { data: spend } = await supabase
    .from("org_marketing_spend")
    .select("month, channel, amount")
    .eq("org_id", tenant.id)
    .gte("month", from.slice(0, 7))
    .lte("month", to.slice(0, 7));
  const spendByChannel = new Map<string, number>();
  for (const s of (spend ?? []) as Array<{ channel: string | null; amount: number | null }>) {
    if (!s.channel) continue;
    spendByChannel.set(s.channel, (spendByChannel.get(s.channel) ?? 0) + Number(s.amount ?? 0));
  }

  const mapToArr = (m: typeof bySource) =>
    Array.from(m.entries()).map(([key, v]) => {
      const sp = spendByChannel.get(key) ?? 0;
      return {
        key,
        sum: v.sum,
        count: v.count,
        uniqueDonors: v.donors.size,
        spend: sp,
        roas: sp > 0 ? v.sum / sp : null,
        cac: v.donors.size > 0 && sp > 0 ? sp / v.donors.size : null,
      };
    }).sort((a, b) => b.sum - a.sum);

  return NextResponse.json({
    range: { from, to },
    bySource: mapToArr(bySource),
    byMedium: mapToArr(byMedium),
    byCampaign: mapToArr(byCampaign),
  });
}
