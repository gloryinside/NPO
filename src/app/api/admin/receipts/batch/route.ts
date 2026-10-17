import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { checkCsrf } from "@/lib/security/csrf";
import { issueAnnualReceipts } from "@/lib/receipt/annual-batch";
import { logAudit } from "@/lib/audit";

/** 한 요청당 기부자 수 — 결제 조회 쿼리의 member_id 목록(URL 길이)을 넘지 않게 */
export const MAX_BATCH = 200;

/**
 * POST /api/admin/receipts/batch  { year, memberIds }
 *
 * 관리자 일괄 발급 — 서버에서 발급만 하고 PDF는 내려보내지 않는다(예전: 브라우저가 한 명씩 PDF를 받아 수십 개 파일이 쏟아짐).
 * 발급 규칙은 연말 자동 발급과 같다(멱등 — 이미 유효한 영수증이 있으면 건너뜀, 기관 기재사항 누락 시 즉시 중단).
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const adminUser = await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as { year?: unknown; memberIds?: unknown } | null;
  const year = Number(body?.year);
  if (!Number.isInteger(year) || year < 2000 || year > 2999) {
    return NextResponse.json({ error: "year가 유효하지 않습니다." }, { status: 400 });
  }
  const memberIds = Array.isArray(body?.memberIds)
    ? [...new Set(body.memberIds.filter((v): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v)))]
    : [];
  if (memberIds.length === 0) {
    return NextResponse.json({ error: "발급할 후원자가 없습니다." }, { status: 400 });
  }
  if (memberIds.length > MAX_BATCH) {
    return NextResponse.json({ error: `한 번에 ${MAX_BATCH}명까지 발급할 수 있습니다.` }, { status: 400 });
  }

  const result = await issueAnnualReceipts(tenant.id, year, {
    memberIds,
    requireOptIn: false,
    issuedBy: adminUser.id,
  });

  await logAudit({
    orgId: tenant.id,
    actorId: adminUser.id,
    actorEmail: adminUser.email ?? null,
    action: "receipt.batch_issue",
    resourceType: "receipt",
    resourceId: null,
    summary: `${year}년 영수증 일괄 발급: 발급 ${result.issued} · 건너뜀 ${result.skipped} · 실패 ${result.failed}${result.blocked ? " · 기관 정보 누락으로 중단" : ""}`,
    metadata: { year, requested: memberIds.length, ...result },
  });

  if (result.blocked) {
    return NextResponse.json(
      { error: "기관 정보에 영수증 필수 기재사항이 없습니다. 기관 설정에서 입력해 주세요.", ...result },
      { status: 422 },
    );
  }
  return NextResponse.json(result);
}
