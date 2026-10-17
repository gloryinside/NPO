import type { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * 모금 통계(/admin/stats) 대시보드·리포트용 집계 쿼리.
 * 화면 코드와 분리해 두어 다른 화면·리포트에서도 재사용할 수 있게 한다.
 */

export type MonthRow = { month: string; total: number; count: number };
export type MemberGrowth = { month: string; joined: number; churned: number };
export type ChurnRateRow = { month: string; total: number; failed: number; rate: number };
export type CampaignSettlement = {
  campaignId: string | null;
  campaignTitle: string;
  paidCount: number;
  paidAmount: number;
  unpaidCount: number;
  unpaidAmount: number;
  rate: number;
};
export type MemberPayRow = {
  memberId: string;
  memberName: string;
  totalPaid: number;
  paidCount: number;
};

export async function fetchMonthlyPayments(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<MonthRow[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("payments")
    .select("pay_date, amount")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("pay_date", startStr)
    .order("pay_date", { ascending: true });

  const map = new Map<string, { total: number; count: number }>();
  for (const row of data ?? []) {
    const month = (row.pay_date as string)?.slice(0, 7);
    if (!month) continue;
    const cur = map.get(month) ?? { total: 0, count: 0 };
    cur.total += Number(row.amount ?? 0);
    cur.count += 1;
    map.set(month, cur);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchMemberGrowth(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<MemberGrowth[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = startDate.toISOString();

  const [joinedData, churnedData] = await Promise.all([
    supabase
      .from("members")
      .select("created_at")
      .eq("org_id", orgId)
      .gte("created_at", startStr)
      .order("created_at", { ascending: true }),
    supabase
      .from("members")
      .select("updated_at")
      .eq("org_id", orgId)
      .eq("status", "inactive")
      .gte("updated_at", startStr),
  ]);

  const joinMap = new Map<string, number>();
  for (const row of joinedData.data ?? []) {
    const month = (row.created_at as string)?.slice(0, 7);
    if (!month) continue;
    joinMap.set(month, (joinMap.get(month) ?? 0) + 1);
  }

  const churnMap = new Map<string, number>();
  for (const row of churnedData.data ?? []) {
    const month = (row.updated_at as string)?.slice(0, 7);
    if (!month) continue;
    churnMap.set(month, (churnMap.get(month) ?? 0) + 1);
  }

  const months = Array.from(new Set([...joinMap.keys(), ...churnMap.keys()])).sort();
  return months.map((month) => ({
    month,
    joined: joinMap.get(month) ?? 0,
    churned: churnMap.get(month) ?? 0,
  }));
}

export async function fetchUnpaidStats(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<{ count: number; total: number }> {
  const { data } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", orgId)
    .in("pay_status", ["unpaid", "failed"]);

  const rows = data ?? [];
  return {
    count: rows.length,
    total: rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
  };
}

export async function fetchChurnRate(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<ChurnRateRow[]> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  const startStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data } = await supabase
    .from("payments")
    .select("pay_date, pay_status")
    .eq("org_id", orgId)
    .gte("pay_date", startStr);

  const map = new Map<string, { total: number; failed: number }>();
  for (const row of data ?? []) {
    const month = (row.pay_date as string)?.slice(0, 7);
    if (!month) continue;
    const cur = map.get(month) ?? { total: 0, failed: 0 };
    cur.total += 1;
    if (row.pay_status === "failed" || row.pay_status === "unpaid") cur.failed += 1;
    map.set(month, cur);
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({
      month,
      total: v.total,
      failed: v.failed,
      rate: v.total > 0 ? Math.round((v.failed / v.total) * 100) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function fetchCampaignSettlement(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string
): Promise<CampaignSettlement[]> {
  const { data } = await supabase
    .from("payments")
    .select("campaign_id, campaigns(title), pay_status, amount")
    .eq("org_id", orgId);

  const map = new Map<
    string,
    { campaignId: string | null; campaignTitle: string; paidCount: number; paidAmount: number; unpaidCount: number; unpaidAmount: number }
  >();
  for (const row of data ?? []) {
    const cid = (row.campaign_id as string | null) ?? "__none__";
    const title = (row as Record<string, unknown>).campaigns
      ? ((row as Record<string, unknown>).campaigns as { title: string })?.title
      : "캠페인 없음";
    const cur = map.get(cid) ?? {
      campaignId: cid === "__none__" ? null : cid,
      campaignTitle: title ?? "캠페인 없음",
      paidCount: 0,
      paidAmount: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
    };
    const amt = Number(row.amount ?? 0);
    if (row.pay_status === "paid") {
      cur.paidCount += 1;
      cur.paidAmount += amt;
    } else {
      cur.unpaidCount += 1;
      cur.unpaidAmount += amt;
    }
    map.set(cid, cur);
  }

  return Array.from(map.values())
    .map((c) => {
      const total = c.paidCount + c.unpaidCount;
      return { ...c, rate: total > 0 ? Math.round((c.paidCount / total) * 100) : 0 };
    })
    .sort((a, b) => b.paidAmount - a.paidAmount);
}

export async function fetchMemberPayRanking(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  orgId: string,
  from: string,
  to: string,
  method?: string
): Promise<MemberPayRow[]> {
  let query = supabase
    .from("payments")
    .select("member_id, amount, members(name)")
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("pay_date", from)
    .lte("pay_date", to);

  if (method) query = query.eq("pay_method", method);

  const { data } = await query;
  const map = new Map<string, MemberPayRow>();
  for (const row of data ?? []) {
    const mid = row.member_id as string;
    if (!mid) continue;
    const member = (row as Record<string, unknown>).members as { name: string } | null;
    const cur = map.get(mid) ?? {
      memberId: mid,
      memberName: member?.name ?? "알 수 없음",
      totalPaid: 0,
      paidCount: 0,
    };
    cur.totalPaid += Number(row.amount ?? 0);
    cur.paidCount += 1;
    map.set(mid, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.totalPaid - a.totalPaid).slice(0, 50);
}
