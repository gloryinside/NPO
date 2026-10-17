import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";
import { csvHeaders } from "@/lib/csv";
import { createClaim } from "@/lib/cms/claim";
import { readJsonObject } from "@/lib/http/body";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("cms_claim_files")
    .select("id, filename, claim_date, payment_count, total_amount, status, submitted_at, success_count, fail_count, created_at")
    .eq("org_id", tenant.id)
    .order("claim_date", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/cms-claim-files
 *   body: { claimDate: 'YYYY-MM-DD', paymentIds: string[], bankAccountId? }
 *   청구 명단을 기록하고 CMS 대행사에 올릴 CSV를 바로 내려준다.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  const claimDate = typeof body.claimDate === "string" ? body.claimDate : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(claimDate)) {
    return NextResponse.json({ error: "출금일을 골라 주세요." }, { status: 400 });
  }
  const paymentIds = Array.isArray(body.paymentIds)
    ? body.paymentIds.filter((v): v is string => typeof v === "string").slice(0, 2000)
    : [];
  const bankAccountId = typeof body.bankAccountId === "string" && body.bankAccountId ? body.bankAccountId : null;

  const supabase = createSupabaseAdminClient();
  const result = await createClaim(supabase, {
    orgId: tenant.id,
    claimDate,
    paymentIds,
    bankAccountId,
    createdBy: user.id,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "cms.claim_create",
    resourceType: "cms_claim_file",
    resourceId: result.claimFileId,
    summary: `자동이체 청구 명단 ${result.paymentCount}건 ${result.totalAmount.toLocaleString("ko-KR")}원 (${claimDate})`,
    metadata: { claimDate, paymentCount: result.paymentCount, totalAmount: result.totalAmount },
  }).catch(() => {});

  return new NextResponse(result.csv, {
    status: 201,
    headers: { ...csvHeaders(result.filename), "X-Claim-File-Id": result.claimFileId },
  });
}
