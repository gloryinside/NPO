import { NextRequest } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toCsv, csvHeaders } from "@/lib/csv";

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

const PAY_STATUS_LABEL: Record<string, string> = {
  paid: "완료",
  pending: "대기",
  unpaid: "미납",
  failed: "실패",
  cancelled: "취소",
  refunded: "환불",
};

const INCOME_STATUS_LABEL: Record<string, string> = {
  pending: "수입대기",
  processing: "수입진행",
  confirmed: "수입완료",
  excluded: "수입제외",
};

/**
 * GET /api/admin/export/payments?status=
 * 납입 현황 CSV 다운로드.
 */
export async function GET(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return new Response("Tenant not found", { status: 400 });
  }

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
    PAY_STATUS_LABEL[p.pay_status] ?? p.pay_status,
    INCOME_STATUS_LABEL[p.income_status] ?? p.income_status,
    p.pg_method ?? p.pay_method ?? "",
  ]);

  const csv = toCsv(
    ["결제코드", "회원코드", "후원자", "캠페인", "금액", "결제일", "납부상태", "수입상태", "결제수단"],
    csvRows
  );

  const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, { headers: csvHeaders(filename) });
}
