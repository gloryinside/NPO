import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_TYPE = new Set(["income_expense", "balance_sheet", "cash_flow", "custom"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const year = req.nextUrl.searchParams.get("year");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("fiscal_reports")
    .select("id, fiscal_year, report_type, period_start, period_end, status, generated_at, notes")
    .eq("org_id", tenant.id).order("fiscal_year", { ascending: false });
  if (year) q = q.eq("fiscal_year", Number(year));
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/fiscal-reports
 *   body: { fiscalYear, reportType, periodStart, periodEnd }
 *   집계 데이터 자동 생성 (income_expense의 경우):
 *     - 수입: payments 합계 (계정과목별, 채널별, 기부종류별)
 *     - 지출: expense_vouchers 합계 (계정과목별, 프로그램별)
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const fiscalYear = Number(body.fiscalYear ?? NaN);
  const reportType = typeof body.reportType === "string" ? body.reportType : "";
  const periodStart = typeof body.periodStart === "string" ? body.periodStart : `${fiscalYear}-01-01`;
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : `${fiscalYear}-12-31`;

  if (!Number.isInteger(fiscalYear) || !VALID_TYPE.has(reportType)) {
    return NextResponse.json({ error: "fiscalYear, reportType 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  // 집계 데이터 빌드
  const data: Record<string, unknown> = {};

  if (reportType === "income_expense") {
    const [paysRes, expRes] = await Promise.all([
      supabase.from("payments")
        .select("amount, campaigns(donation_kind, chart_of_accounts:revenue_account_id(code, name))")
        .eq("org_id", tenant.id).eq("pay_status", "paid")
        .gte("pay_date", periodStart).lte("pay_date", periodEnd),
      supabase.from("expense_voucher_lines")
        .select("amount, expense_account_id, chart_of_accounts:expense_account_id(code, name), expense_vouchers!inner(voucher_date, status, org_id)")
        .eq("expense_vouchers.org_id", tenant.id)
        .eq("expense_vouchers.status", "paid")
        .gte("expense_vouchers.voucher_date", periodStart)
        .lte("expense_vouchers.voucher_date", periodEnd),
    ]);

    type PRow = { amount: number; campaigns: unknown };
    type ERow = { amount: number; chart_of_accounts: unknown };

    const incomeByAccount = new Map<string, number>();
    const incomeByKind = new Map<string, number>();
    let incomeTotal = 0;
    for (const r of (paysRes.data ?? []) as PRow[]) {
      const a = Number(r.amount);
      incomeTotal += a;
      const camp = (Array.isArray(r.campaigns) ? r.campaigns[0] : r.campaigns) as
        { donation_kind?: string | null; chart_of_accounts?: unknown } | null;
      const coa = camp ? (Array.isArray(camp.chart_of_accounts) ? camp.chart_of_accounts[0] : camp.chart_of_accounts) as { code?: string; name?: string } | null : null;
      const k = coa?.name ?? "(미설정)";
      incomeByAccount.set(k, (incomeByAccount.get(k) ?? 0) + a);
      const kind = camp?.donation_kind ?? "other";
      incomeByKind.set(kind, (incomeByKind.get(kind) ?? 0) + a);
    }

    const expenseByAccount = new Map<string, number>();
    let expenseTotal = 0;
    for (const r of (expRes.data ?? []) as ERow[]) {
      const a = Number(r.amount);
      expenseTotal += a;
      const coa = (Array.isArray(r.chart_of_accounts) ? r.chart_of_accounts[0] : r.chart_of_accounts) as
        { code?: string; name?: string } | null;
      const k = coa?.name ?? "(미설정)";
      expenseByAccount.set(k, (expenseByAccount.get(k) ?? 0) + a);
    }

    data.income = {
      total: incomeTotal,
      byAccount: Array.from(incomeByAccount, ([k, v]) => ({ key: k, sum: v })),
      byDonationKind: Array.from(incomeByKind, ([k, v]) => ({ key: k, sum: v })),
    };
    data.expense = {
      total: expenseTotal,
      byAccount: Array.from(expenseByAccount, ([k, v]) => ({ key: k, sum: v })),
    };
    data.netIncome = incomeTotal - expenseTotal;
  }

  const { data: row, error } = await supabase
    .from("fiscal_reports")
    .insert({
      org_id: tenant.id,
      fiscal_year: fiscalYear,
      report_type: reportType,
      period_start: periodStart,
      period_end: periodEnd,
      data,
      status: "draft",
      generated_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: row?.id, data });
}
