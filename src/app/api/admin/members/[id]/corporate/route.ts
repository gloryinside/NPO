import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { normalizeBRN, isValidBRN } from "@/lib/members/brn";

/**
 * PATCH /api/admin/members/[id]/corporate
 *   법인 후원자 정보 일괄 갱신.
 *   business_reg_no 입력 시 BRN 체크섬 검증.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = {};

  if (typeof body.businessRegNo === "string") {
    const brn = normalizeBRN(body.businessRegNo);
    if (brn && !isValidBRN(brn)) {
      return NextResponse.json(
        { error: "사업자등록번호 체크섬 실패" },
        { status: 400 }
      );
    }
    update.business_reg_no = brn || null;
  }
  if (typeof body.corpLegalName === "string") update.corp_legal_name = body.corpLegalName.trim() || null;
  if (typeof body.ceoName === "string") update.ceo_name = body.ceoName.trim() || null;
  if (typeof body.bizType === "string") update.biz_type = body.bizType.trim() || null;
  if (typeof body.bizCategory === "string") update.biz_category = body.bizCategory.trim() || null;
  if (typeof body.bizAddress === "string") update.biz_address = body.bizAddress.trim() || null;
  if (typeof body.taxInvoiceEmail === "string") update.tax_invoice_email = body.taxInvoiceEmail.trim() || null;
  if (typeof body.taxInvoiceRequired === "boolean") update.tax_invoice_required = body.taxInvoiceRequired;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정 항목 없음" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select(
      "id, business_reg_no, corp_legal_name, ceo_name, biz_type, biz_category, biz_address, tax_invoice_email, tax_invoice_required"
    )
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ member: data });
}
