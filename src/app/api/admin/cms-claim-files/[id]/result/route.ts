import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";
import { applyClaimResult } from "@/lib/cms/claim";
import { kstParts } from "@/lib/billing/kst";

/**
 * POST /api/admin/cms-claim-files/[id]/result
 *   body: { failedLineIds: string[], failReason? }
 *   대행사 출금 결과 반영 — 실패로 고른 줄 외에는 모두 출금 완료로 처리한다.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const failedLineIds = Array.isArray(body.failedLineIds)
    ? body.failedLineIds.filter((v): v is string => typeof v === "string")
    : [];
  const failReason = typeof body.failReason === "string" ? body.failReason : null;
  const { year, month, day } = kstParts();
  const depositDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const result = await applyClaimResult(createSupabaseAdminClient(), {
    orgId: tenant.id,
    fileId: id,
    failedLineIds,
    failReason,
    depositDate,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "cms.claim_result",
    resourceType: "cms_claim_file",
    resourceId: id,
    summary: `자동이체 출금 결과 반영: 완료 ${result.paid}건, 실패 ${result.failed}건`,
    metadata: { paid: result.paid, failed: result.failed },
  }).catch(() => {});

  return NextResponse.json(result);
}
