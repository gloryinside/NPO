import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";

/**
 * PUT /api/admin/settings/admin-mfa — 모든 관리자에게 2단계 인증 요구 켜기/끄기. body: { required }
 * 최고 관리자만. 켤 때는 요청한 본인이 2단계 인증을 마친 세션(aal2)이어야 한다 — 본인이 잠기지 않게.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { roles } = await getAdminRoles(user.id, tenant.id);
  if (!roles.includes("super")) return NextResponse.json({ error: "최고 관리자만 바꿀 수 있습니다." }, { status: 403 });

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.required !== "boolean") return NextResponse.json({ error: "required 값이 필요합니다." }, { status: 400 });
  const required = parsed.body.required;

  if (required) {
    const { data } = await (await createSupabaseServerClient()).auth.mfa.getAuthenticatorAssuranceLevel();
    if (data?.currentLevel !== "aal2") {
      return NextResponse.json({ error: "먼저 내 계정에 2단계 인증을 등록하고 코드로 로그인해 주세요." }, { status: 400 });
    }
  }

  const { error } = await createSupabaseAdminClient().from("orgs").update({ admin_mfa_required: required }).eq("id", tenant.id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "settings.admin_mfa",
    resourceType: "org",
    resourceId: tenant.id,
    summary: `관리자 2단계 인증 필수 ${required ? "켬" : "끔"}`,
  });
  return NextResponse.json({ ok: true });
}
