import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";

/** DELETE /api/admin/ab-tests/[id] — 비교 끝내기(결과는 남는다, 신청 화면은 캠페인 설정으로 돌아간다) */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;
  const { data, error } = await createSupabaseAdminClient()
    .from("form_ab_tests")
    .update({ status: "stopped", stopped_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .eq("status", "running")
    .select("name")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "진행 중인 비교가 아닙니다." }, { status: 404 });
  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "ab_test.stop", resourceType: "form_ab_test", resourceId: id, summary: `신청 화면 A/B 비교 종료 (${data.name})`,
  });
  return NextResponse.json({ ok: true });
}
