import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { parseOfficer } from "@/lib/legal/privacy-settings";

/**
 * PUT /api/admin/settings/privacy — 개인정보 보호책임자 { officer: { name, title, phone, email } }
 * 처리방침 12항에 그대로 실린다. 최고 관리자만.
 */
export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { roles } = await getAdminRoles(user.id, tenant.id);
  if (!roles.includes("super")) return NextResponse.json({ error: "최고 관리자만 바꿀 수 있습니다." }, { status: 403 });

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const officer = parseOfficer(parsed.body.officer);
  if (!officer.ok) return NextResponse.json({ error: officer.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data: org } = await supabase.from("orgs").select("privacy_settings").eq("id", tenant.id).maybeSingle();
  const next = { ...((org?.privacy_settings ?? {}) as Record<string, unknown>), officer: officer.value };
  const { error } = await supabase.from("orgs").update({ privacy_settings: next }).eq("id", tenant.id);
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "settings.privacy_officer", resourceType: "org", resourceId: tenant.id,
    summary: `개인정보 보호책임자 지정 (${officer.value.name})`,
  });
  return NextResponse.json({ ok: true });
}
