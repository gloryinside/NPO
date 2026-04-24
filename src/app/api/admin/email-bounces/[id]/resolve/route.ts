import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { logAudit } from "@/lib/audit";

/**
 * POST /api/admin/email-bounces/[id]/resolve
 *
 * 어드민이 반송 건을 "처리 완료"로 표시한다.
 * body.reactivateMember = true 면 해당 회원의 email_disabled 도 해제한다
 * (회원이 이메일 주소를 수정한 뒤 다시 받기 시작하는 케이스).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: { reactivateMember?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reactivateMember = body.reactivateMember === true;
  const note = typeof body.note === "string" ? body.note.trim() : null;

  const supabase = createSupabaseAdminClient();

  const { data: row } = await supabase
    .from("email_bounces")
    .select("id, recipient_email, resolved_at, bounce_type")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.resolved_at) {
    return NextResponse.json({ error: "이미 처리됨" }, { status: 400 });
  }

  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("email_bounces")
    .update({
      resolved_at: nowIso,
      resolved_by: user.id,
      resolved_note: note,
    })
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let reactivatedCount = 0;
  if (reactivateMember && row.recipient_email) {
    const { data: updated } = await supabase
      .from("members")
      .update({
        email_disabled: false,
        email_disabled_reason: null,
      })
      .eq("org_id", tenant.id)
      .eq("email", row.recipient_email.toLowerCase())
      .eq("email_disabled", true)
      .select("id");
    reactivatedCount = updated?.length ?? 0;
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "email_bounce.resolve",
    resourceType: "email_bounce",
    resourceId: id,
    summary: reactivateMember
      ? `반송 처리 완료 + 이메일 재활성 (${reactivatedCount}명)`
      : `반송 처리 완료`,
    metadata: {
      email: row.recipient_email,
      bounceType: row.bounce_type,
      reactivateMember,
      reactivatedCount,
      note,
    },
  }).catch(() => {});

  return NextResponse.json({ ok: true, reactivatedCount });
}
