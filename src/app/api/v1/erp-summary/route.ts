import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authenticateV1 } from "@/lib/erp/v1-auth";

/**
 * GET /api/v1/erp-summary?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   ERP가 일배치로 가져가는 집계 (계정과목/사업/거래처별 요약).
 *   세부 payment 라인은 /api/v1/payments 에서 조회.
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateV1(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const orgId = authResult.orgId;
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  if (!from || !to) return NextResponse.json({ error: "from, to 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("payments")
    .select(
      "amount, pay_date, income_status, campaign_id, campaigns(donation_kind, revenue_account_id, chart_of_accounts:revenue_account_id(code, name))"
    )
    .eq("org_id", orgId)
    .eq("pay_status", "paid")
    .gte("pay_date", from)
    .lte("pay_date", to);

  type Row = { amount: number; pay_date: string; income_status: string;
    campaigns: { donation_kind: string | null; chart_of_accounts: { code: string; name: string } | null } | null };
  const list = (data ?? []) as unknown as Row[];

  // 계정과목별
  const byAccount = new Map<string, { code: string | null; name: string; sum: number; confirmed: number }>();
  for (const r of list) {
    const k = r.campaigns?.chart_of_accounts?.code ?? "(미설정)";
    const cur = byAccount.get(k) ?? {
      code: r.campaigns?.chart_of_accounts?.code ?? null,
      name: r.campaigns?.chart_of_accounts?.name ?? "(미설정)",
      sum: 0, confirmed: 0,
    };
    cur.sum += Number(r.amount);
    if (r.income_status === "confirmed") cur.confirmed += Number(r.amount);
    byAccount.set(k, cur);
  }

  // 사업별 분배
  const { data: allocs } = await supabase
    .from("payment_program_allocations")
    .select("amount, programs(code, name)")
    .eq("org_id", orgId);
  const byProgram = new Map<string, { code: string | null; name: string; sum: number }>();
  for (const rawA of (allocs ?? []) as unknown[]) {
    const a = rawA as { amount: number; programs: unknown };
    const prog = (Array.isArray(a.programs) ? a.programs[0] : a.programs) as
      { code: string | null; name: string } | null;
    const k = prog?.code ?? prog?.name ?? "(미지정)";
    const cur = byProgram.get(k) ?? {
      code: prog?.code ?? null,
      name: prog?.name ?? "(미지정)",
      sum: 0,
    };
    cur.sum += Number(a.amount);
    byProgram.set(k, cur);
  }

  return NextResponse.json({
    range: { from, to },
    totalConfirmed: list.filter((r) => r.income_status === "confirmed").reduce((a, r) => a + Number(r.amount), 0),
    totalPaid: list.reduce((a, r) => a + Number(r.amount), 0),
    byRevenueAccount: Array.from(byAccount.values()),
    byProgram: Array.from(byProgram.values()),
  });
}
