import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { parsePlanInput } from "@/lib/membership/fees";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("membership_fee_plans")
    .select("id, name, fee_amount, cycle, active, description")
    .eq("org_id", tenant.id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const input = parsePlanInput(parsed.body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("membership_fee_plans")
    .insert({
      org_id: tenant.id,
      name: input.value.name,
      fee_amount: input.value.feeAmount,
      cycle: input.value.cycle,
      description: input.value.description,
      active: parsed.body.active !== false,
    })
    .select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "같은 이름의 회비가 있습니다." }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "membership.plan_save", resourceType: "membership_fee_plan", resourceId: data?.id ?? null,
    summary: `회비 종류 추가 (${input.value.name})`,
  });
  return NextResponse.json({ id: data?.id });
}
