import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/erp-summary/daily?date=YYYY-MM-DD&unitId=...
 *   일계표: 채널/계정과목/사업별 합계.
 *   ERP 일배치 인입용.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const date = req.nextUrl.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const unitId = req.nextUrl.searchParams.get("unitId");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("payments")
    .select("amount, pay_status, income_status, pg_method, channel_id, campaign_id, unit_id, deposit_bank_account_id, donation_channels:channel_id(code, name), campaigns(donation_kind, revenue_account_id, chart_of_accounts:revenue_account_id(code, name)), bank_accounts:deposit_bank_account_id(bank_name)")
    .eq("org_id", tenant.id)
    .eq("pay_date", date);
  if (unitId) q = q.eq("unit_id", unitId);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    amount: number; pay_status: string; income_status: string;
    pg_method: string | null; channel_id: string | null; unit_id: string | null;
    donation_channels: { name: string } | null;
    campaigns: { donation_kind: string | null; chart_of_accounts: { code: string; name: string } | null } | null;
    bank_accounts: { bank_name: string } | null;
  };
  const list = (data ?? []) as unknown as Row[];

  // 집계
  let total = 0; let confirmedTotal = 0; let count = 0;
  const byMethod = new Map<string, number>();
  const byChannel = new Map<string, number>();
  const byAccount = new Map<string, number>();
  const byBank = new Map<string, number>();
  const byKind = new Map<string, number>();
  const byStatus = new Map<string, number>();

  for (const r of list) {
    const a = Number(r.amount);
    total += a;
    count++;
    byStatus.set(r.pay_status, (byStatus.get(r.pay_status) ?? 0) + a);
    if (r.pay_status === "paid") {
      if (r.income_status === "confirmed") confirmedTotal += a;
      const key = r.pg_method ?? "(미지정)";
      byMethod.set(key, (byMethod.get(key) ?? 0) + a);
      const ch = r.donation_channels?.name ?? "(미지정)";
      byChannel.set(ch, (byChannel.get(ch) ?? 0) + a);
      const acc = r.campaigns?.chart_of_accounts?.name ?? "(미설정)";
      byAccount.set(acc, (byAccount.get(acc) ?? 0) + a);
      const bank = r.bank_accounts?.bank_name ?? "(미지정)";
      byBank.set(bank, (byBank.get(bank) ?? 0) + a);
      const kind = r.campaigns?.donation_kind ?? "other";
      byKind.set(kind, (byKind.get(kind) ?? 0) + a);
    }
  }

  return NextResponse.json({
    date,
    total,
    confirmedTotal,
    count,
    byPayStatus: Array.from(byStatus, ([k, v]) => ({ key: k, sum: v })),
    byMethod: Array.from(byMethod, ([k, v]) => ({ key: k, sum: v })),
    byChannel: Array.from(byChannel, ([k, v]) => ({ key: k, sum: v })),
    byRevenueAccount: Array.from(byAccount, ([k, v]) => ({ key: k, sum: v })),
    byBankAccount: Array.from(byBank, ([k, v]) => ({ key: k, sum: v })),
    byDonationKind: Array.from(byKind, ([k, v]) => ({ key: k, sum: v })),
  });
}
