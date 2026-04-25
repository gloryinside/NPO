import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/erp-summary/monthly?year=YYYY&month=MM&unitId=...
 *   월계표: 일별 합계 + 월 누계.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year") ?? new Date().getFullYear());
  const month = Number(sp.get("month") ?? new Date().getMonth() + 1);
  const unitId = sp.get("unitId");

  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "year, month 유효" }, { status: 400 });
  }

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("payments")
    .select("amount, pay_date, pay_status, income_status, unit_id, campaign_id, campaigns(donation_kind)")
    .eq("org_id", tenant.id)
    .eq("pay_status", "paid")
    .gte("pay_date", start)
    .lt("pay_date", nextMonth);
  if (unitId) q = q.eq("unit_id", unitId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = { amount: number; pay_date: string; income_status: string;
    campaigns: { donation_kind: string | null } | null };
  const list = (data ?? []) as unknown as Row[];

  // 일별 합계
  const dayMap = new Map<string, { all: number; confirmed: number }>();
  let total = 0; let totalConfirmed = 0;
  const byKind = new Map<string, number>();

  for (const r of list) {
    const a = Number(r.amount);
    const d = r.pay_date;
    const cur = dayMap.get(d) ?? { all: 0, confirmed: 0 };
    cur.all += a;
    if (r.income_status === "confirmed") {
      cur.confirmed += a;
      totalConfirmed += a;
    }
    dayMap.set(d, cur);
    total += a;
    const k = r.campaigns?.donation_kind ?? "other";
    byKind.set(k, (byKind.get(k) ?? 0) + a);
  }

  const days = Array.from(dayMap.entries())
    .map(([date, sums]) => ({ date, ...sums }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return NextResponse.json({
    year, month,
    total, totalConfirmed,
    count: list.length,
    days,
    byDonationKind: Array.from(byKind, ([k, v]) => ({ key: k, sum: v })),
  });
}
