import { NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvHeaders } from "@/lib/csv";
import { payStatusLabel, incomeStatusLabel, payMethodLabel } from "@/lib/labels";
import { requireAdminApi } from "@/lib/auth/api-guard";

type PaymentExport = {
  payment_code: string;
  amount: number;
  pay_date: string | null;
  pay_status: string;
  income_status: string;
  pg_method: string | null;
  pay_method: string | null;
  members: { name: string; member_code: string } | null;
  campaigns: { title: string } | null;
};

/**
 * GET /api/admin/export/payments?status=
 * 납입 현황 CSV 다운로드.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "all";

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("payments")
    .select(
      "payment_code, amount, pay_date, pay_status, income_status, pg_method, pay_method, members(name, member_code), campaigns(title)"
    )
    .eq("org_id", tenant.id);

  if (status !== "all") query = query.eq("pay_status", status);

  const { data, error } = await query.order("pay_date", { ascending: false }).limit(10000);

  if (error) return new Response(error.message, { status: 500 });

  const rows = (data as unknown as PaymentExport[]) ?? [];
  const csvRows = rows.map((p) => [
    p.payment_code,
    p.members?.member_code ?? "",
    p.members?.name ?? "",
    p.campaigns?.title ?? "",
    p.amount,
    p.pay_date ? new Date(p.pay_date).toLocaleDateString("ko-KR") : "",
    payStatusLabel(p.pay_status),
    incomeStatusLabel(p.income_status),
    p.pg_method ?? payMethodLabel(p.pay_method),
  ]);

  const csv = toCsv(
    ["결제번호", "후원자번호", "후원자", "캠페인", "금액", "결제일", "결제 상태", "회계 반영", "결제수단"],
    csvRows
  );

  const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: csvHeaders(filename) });
}
