import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";

/** POST /api/admin/membership-fees/assign — { memberId, planId | null } 회비 가입·변경·해지 (납부 만료일은 그대로) */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const memberId = typeof parsed.body.memberId === "string" ? parsed.body.memberId : "";
  const planId = parsed.body.planId === null ? null : typeof parsed.body.planId === "string" ? parsed.body.planId : undefined;
  if (!/^[0-9a-f-]{36}$/i.test(memberId) || planId === undefined) return NextResponse.json({ error: "회원과 회비 종류를 골라 주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  if (planId) {
    const { data: plan } = await supabase.from("membership_fee_plans").select("id, active").eq("id", planId).eq("org_id", tenant.id).maybeSingle();
    if (!plan || !plan.active) return NextResponse.json({ error: "쓸 수 있는 회비 종류가 아닙니다." }, { status: 400 });
  }
  const { data, error } = await supabase
    .from("members")
    .update({ fee_plan_id: planId })
    .eq("id", memberId)
    .eq("org_id", tenant.id)
    .select("name")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "회원을 찾을 수 없습니다." }, { status: 404 });

  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "membership.plan_assign", resourceType: "member", resourceId: memberId,
    summary: planId ? `회비 가입·변경 (${data.name})` : `회비 해지 (${data.name})`, metadata: { planId },
  });
  return NextResponse.json({ ok: true });
}
