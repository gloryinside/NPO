import { NextRequest, NextResponse } from "next/server";
import { adminClaims } from "@/lib/auth/tenant-binding";
import { adminMfaState, mfaRequiredBody } from "@/lib/auth/admin-mfa";
import { createRequestClient } from "@/lib/supabase/request-client";

/**
 * Builder API (campaigns/[id]/...) 용 공통 가드.
 *
 * 검사:
 *   1. 로그인 여부
 *   2. app_metadata.role === 'admin'  (user_metadata는 사용자가 바꿀 수 있어 쓰지 않는다)
 *   3. app_metadata.org_id 존재
 *   4. (선택) campaignId가 주어지면 해당 캠페인의 org_id 일치
 *
 * 성공 시 { orgId, userId, userEmail } 반환.
 * 실패 시 NextResponse (401/403) 반환 — 호출부에서 early return 용도.
 */
export async function requireAdminOrgForBuilder(
  req: NextRequest,
  options?: { campaignId?: string }
): Promise<
  | { ok: true; orgId: string; userId: string; userEmail: string | null }
  | { ok: false; response: NextResponse }
> {
  const sb = createRequestClient(req);
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }

  const claims = adminClaims(user);
  if (!claims) {
    return {
      ok: false,
      response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
    };
  }

  const orgId: string | undefined = claims.orgId;
  if (!orgId) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "forbidden: no org_id" },
        { status: 403 }
      ),
    };
  }

  const mfa = await adminMfaState(sb, orgId);
  if (mfa !== "ok") {
    return { ok: false, response: NextResponse.json(mfaRequiredBody(mfa), { status: 403 }) };
  }

  if (options?.campaignId) {
    const { data: campaign } = await sb
      .from("campaigns")
      .select("org_id")
      .eq("id", options.campaignId)
      .single();
    if (!campaign || campaign.org_id !== orgId) {
      return {
        ok: false,
        response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
      };
    }
  }

  return {
    ok: true,
    orgId,
    userId: user.id,
    userEmail: user.email ?? null,
  };
}
