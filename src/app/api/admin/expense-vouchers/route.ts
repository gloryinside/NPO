import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["draft", "submitted", "reviewed", "approved", "paid", "rejected"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("expense_vouchers")
    .select("id, voucher_no, voucher_date, total_amount, vendor, description, status, submitted_at, approved_at, paid_at, programs(name)")
    .eq("org_id", tenant.id)
    .order("voucher_date", { ascending: false }).limit(200);
  if (status && VALID_STATUS.has(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const voucherDate = typeof body.voucherDate === "string"
    ? body.voucherDate : new Date().toISOString().slice(0, 10);
  const totalAmount = Number(body.totalAmount ?? NaN);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!(totalAmount >= 0) || !description) {
    return NextResponse.json({ error: "totalAmount, description 필수" }, { status: 400 });
  }

  // voucher_no 자동 생성: EXP-YYYYMM-NNNN
  const supabase = createSupabaseAdminClient();
  const yyyymm = voucherDate.slice(0, 7).replace("-", "");
  const { count } = await supabase
    .from("expense_vouchers").select("id", { count: "exact", head: true })
    .eq("org_id", tenant.id).gte("voucher_date", `${voucherDate.slice(0, 7)}-01`);
  const voucherNo = `EXP-${yyyymm}-${String((count ?? 0) + 1).padStart(4, "0")}`;

  const { data, error } = await supabase
    .from("expense_vouchers")
    .insert({
      org_id: tenant.id,
      voucher_no: voucherNo,
      voucher_date: voucherDate,
      program_id: typeof body.programId === "string" ? body.programId : null,
      total_amount: totalAmount,
      vendor: typeof body.vendor === "string" ? body.vendor : null,
      description,
      status: "draft",
      submitted_by: user.id,
    })
    .select("id, voucher_no")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
