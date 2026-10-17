import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["pending", "issued", "sent", "cancelled"]);

/**
 * GET  /api/admin/tax-invoices?status=pending  — 발행 대기 큐
 * POST /api/admin/tax-invoices  — 결제 ID 기준으로 세금계산서 큐 추가
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status") ?? "pending";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tax_invoices")
    .select(
      "id, member_id, payment_id, business_reg_no, corp_legal_name, ceo_name, tax_invoice_email, amount, issue_date, invoice_no, status, external_provider, created_at, members(name)"
    )
    .eq("org_id", tenant.id)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject<{ paymentId?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  if (!paymentId) return NextResponse.json({ error: "paymentId 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: pay } = await supabase
    .from("payments")
    .select(
      "id, amount, members(id, business_reg_no, corp_legal_name, ceo_name, biz_address, tax_invoice_email)"
    )
    .eq("id", paymentId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!pay) return NextResponse.json({ error: "payment not found" }, { status: 404 });

  const memberRaw = (pay as { members?: unknown }).members;
  const member = (Array.isArray(memberRaw) ? memberRaw[0] : memberRaw) as
    | {
        id: string;
        business_reg_no: string | null;
        corp_legal_name: string | null;
        ceo_name: string | null;
        biz_address: string | null;
        tax_invoice_email: string | null;
      }
    | null;
  if (!member?.business_reg_no || !member.corp_legal_name) {
    return NextResponse.json(
      { error: "법인 정보 (사업자번호+법인명) 미입력" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("tax_invoices")
    .insert({
      org_id: tenant.id,
      member_id: member.id,
      payment_id: pay.id,
      business_reg_no: member.business_reg_no,
      corp_legal_name: member.corp_legal_name,
      ceo_name: member.ceo_name,
      biz_address: member.biz_address,
      tax_invoice_email: member.tax_invoice_email,
      amount: Number(pay.amount ?? 0),
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
