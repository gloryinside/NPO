import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/** DELETE /api/admin/f2f-agents/[id] — 링크 중지(기록·실적은 남는다) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  const { data, error } = await createSupabaseAdminClient()
    .from("f2f_agents")
    .update({ active: false })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("name, code")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "링크를 찾을 수 없습니다." }, { status: 404 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "f2f.agent_revoke",
    resourceType: "f2f_agent",
    resourceId: id,
    summary: `현장 모금 링크 중지 (${data.name}/${data.code})`,
  });
  return NextResponse.json({ ok: true });
}
