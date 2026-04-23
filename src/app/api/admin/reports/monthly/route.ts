import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CSV_BOM, csvRow } from "@/lib/csv/escape";
import { logAudit } from "@/lib/audit";

/**
 * G-D139: 월별 재무 요약.
 *
 * GET /api/admin/reports/monthly?year=2026&month=4&format=csv|json
 *   기본: CSV (Excel 호환)
 *
 * 포함 지표(해당 월):
 *   - 총 결제 건수 / 금액 (paid)
 *   - 실패 / 취소 / 환불 건수 · 금액
 *   - 순 수입 (paid - refund_amount)
 *   - 캠페인별 집계
 *   - 정기 vs 일시 비중
 */
const PAID = "paid";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year"));
  const month = Number(sp.get("month"));
  const format = sp.get("format") === "json" ? "json" : "csv";
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "invalid year" }, { status: 400 });
  }
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: "invalid month" }, { status: 400 });
  }

  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const supabase = createSupabaseAdminClient();

  const { data } = await supabase
    .from("payments")
    .select(
      "amount, pay_status, refund_amount, pay_method, campaigns(title), promises(type)"
    )
    .eq("org_id", tenant.id)
    .gte("pay_date", first)
    .lte("pay_date", last);

  type Row = {
    amount: number | null;
    pay_status: string;
    refund_amount: number | null;
    pay_method: string | null;
    campaigns: { title: string } | null;
    promises: { type: string } | null;
  };
  const rows = (data as unknown as Row[]) ?? [];

  let paidCount = 0;
  let paidAmount = 0;
  let failedCount = 0;
  let cancelledCount = 0;
  let refundCount = 0;
  let refundAmount = 0;
  let regularCount = 0;
  let onetimeCount = 0;
  const byCampaign = new Map<string, { count: number; amount: number }>();

  for (const r of rows) {
    const amt = Number(r.amount ?? 0);
    if (r.pay_status === PAID) {
      paidCount++;
      paidAmount += amt;
      if (r.promises?.type === "regular") regularCount++;
      else if (r.promises?.type === "onetime") onetimeCount++;
      const key = r.campaigns?.title ?? "(일반)";
      const cur = byCampaign.get(key) ?? { count: 0, amount: 0 };
      cur.count++;
      cur.amount += amt;
      byCampaign.set(key, cur);
    } else if (r.pay_status === "failed") failedCount++;
    else if (r.pay_status === "cancelled") cancelledCount++;
    else if (r.pay_status === "refunded") {
      refundCount++;
      refundAmount += Number(r.refund_amount ?? 0);
    }
  }

  const net = paidAmount - refundAmount;

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.data_export",
    resourceType: "financial_report",
    summary: `${year}년 ${month}월 재무 리포트 조회`,
    metadata: { year, month, format, paidCount, paidAmount, refundAmount, net },
  }).catch(() => {});

  if (format === "json") {
    return NextResponse.json({
      period: { year, month, from: first, to: last },
      totals: {
        paidCount,
        paidAmount,
        failedCount,
        cancelledCount,
        refundCount,
        refundAmount,
        netAmount: net,
        regularCount,
        onetimeCount,
      },
      byCampaign: [...byCampaign.entries()]
        .map(([title, v]) => ({ title, count: v.count, amount: v.amount }))
        .sort((a, b) => b.amount - a.amount),
    });
  }

  const lines: string[] = [];
  lines.push(csvRow(["지표", "값"]));
  lines.push(csvRow(["기간", `${first} ~ ${last}`]));
  lines.push(csvRow(["결제 건수(paid)", paidCount]));
  lines.push(csvRow(["결제 금액(paid)", paidAmount]));
  lines.push(csvRow(["실패 건수", failedCount]));
  lines.push(csvRow(["취소 건수", cancelledCount]));
  lines.push(csvRow(["환불 건수", refundCount]));
  lines.push(csvRow(["환불 금액", refundAmount]));
  lines.push(csvRow(["순 수입", net]));
  lines.push(csvRow(["정기 건수", regularCount]));
  lines.push(csvRow(["일시 건수", onetimeCount]));
  lines.push("");
  lines.push(csvRow(["캠페인", "건수", "금액"]));
  for (const [title, v] of [...byCampaign.entries()].sort(
    (a, b) => b[1].amount - a[1].amount
  )) {
    lines.push(csvRow([title, v.count, v.amount]));
  }

  const body = CSV_BOM + lines.join("\r\n");
  const fname = `monthly_${year}-${String(month).padStart(2, "0")}.csv`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
