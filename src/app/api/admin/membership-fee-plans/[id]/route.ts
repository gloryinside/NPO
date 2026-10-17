import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { parsePlanInput } from "@/lib/membership/fees";

/** PATCH /api/admin/membership-fee-plans/[id] — { name, feeAmount, cycle, description } 수정 또는 { active } 켜고 끄기 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;

  let patch: Record<string, unknown>;
  if (Object.keys(parsed.body).length === 1 && typeof parsed.body.active === "boolean") {
    patch = { active: parsed.body.active };
  } else {
    const input = parsePlanInput(parsed.body);
    if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });
    patch = { name: input.value.name, fee_amount: input.value.feeAmount, cycle: input.value.cycle, description: input.value.description };
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("membership_fee_plans")
    .update(patch)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("name")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "같은 이름의 회비가 있습니다." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "회비 종류를 찾을 수 없습니다." }, { status: 404 });
  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "membership.plan_save", resourceType: "membership_fee_plan", resourceId: id,
    summary: `회비 종류 수정 (${data.name})`, metadata: patch,
  });
  return NextResponse.json({ ok: true });
}
