import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { readJsonObject } from "@/lib/http/body";
import { parseStepUpdate } from "@/lib/journey/admin";
import { stepDef } from "@/lib/journey/steps";

type Ctx = { params: Promise<{ step: string }> };

/** PUT /api/admin/journeys/[step] — 켜기/끄기와 문구 저장. body: { enabled, subject, body } */
export async function PUT(req: NextRequest, { params }: Ctx) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { step } = await params;
  const def = stepDef(step);
  if (!def) return NextResponse.json({ error: "없는 단계입니다." }, { status: 404 });

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const input = parseStepUpdate(parsed.body);
  if (!input.ok) return NextResponse.json({ error: input.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("journey_steps").upsert(
    {
      org_id: tenant.id,
      step_key: def.key,
      enabled: input.value.enabled,
      subject: input.value.subject,
      body: input.value.body,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,step_key" },
  );
  if (error) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "journey.update",
    resourceType: "journey_step",
    resourceId: null,
    summary: `여정 메시지 '${def.title}' ${input.value.enabled ? "켬" : "끔"}`,
    metadata: { step: def.key, enabled: input.value.enabled },
  });
  return NextResponse.json({ ok: true });
}
