import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { buildEftClaimFile } from "@/lib/erp/eft-builder";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_claim_files")
    .select("id, filename, file_format, claim_date, payment_count, total_amount, status, submitted_at, success_count, fail_count, created_at")
    .eq("org_id", tenant.id)
    .order("claim_date", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/cms-claim-files
 *   body: { claimDate, bankAccountId, paymentIds? }
 *   EFT 청구 파일 생성 + 텍스트 본문 응답.
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const claimDate = typeof body.claimDate === "string"
    ? body.claimDate : new Date().toISOString().slice(0, 10);
  const bankAccountId = typeof body.bankAccountId === "string" ? body.bankAccountId : "";
  if (!bankAccountId) return NextResponse.json({ error: "bankAccountId 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const result = await buildEftClaimFile(supabase, {
    orgId: tenant.id,
    claimDate,
    bankAccountId,
    paymentIds: Array.isArray(body.paymentIds) ? (body.paymentIds as string[]) : undefined,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json(result);
}
