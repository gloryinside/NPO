import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";

/**
 * G-D147: 카드 분쟁 상태 전환 + 증빙 보관.
 *
 * PATCH /api/admin/chargebacks/[id]/status
 *   body: { status: 'evidence_submitted'|'won'|'lost'|'closed', note?, evidenceUrl? }
 *
 * finance 또는 super 전용.
 */
const ALLOWED = new Set([
  "open",
  "evidence_submitted",
  "won",
  "lost",
  "closed",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json(
      { error: "finance 또는 super 권한 필요" },
      { status: 403 }
    );
  }
  const { id } = await params;

  let body: { status?: unknown; note?: unknown; evidenceUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      { error: `유효하지 않은 status: ${status}` },
      { status: 400 }
    );
  }
  const note = typeof body.note === "string" ? body.note : null;
  const evidenceUrl =
    typeof body.evidenceUrl === "string" ? body.evidenceUrl : null;

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("chargebacks")
    .select("id, status, evidence_json")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const evidencePrev =
    (row.evidence_json as Record<string, unknown> | null) ?? {};
  const nowIso = new Date().toISOString();
  const update: Record<string, unknown> = {
    status,
    updated_at: nowIso,
  };
  if (status === "closed" || status === "won" || status === "lost") {
    update.closed_at = nowIso;
  }

  const additions: Array<Record<string, unknown>> = Array.isArray(
    evidencePrev.notes
  )
    ? (evidencePrev.notes as Array<Record<string, unknown>>)
    : [];
  if (note || evidenceUrl) {
    additions.push({
      at: nowIso,
      by: user.email ?? user.id,
      note,
      evidenceUrl,
      status,
    });
    update.evidence_json = { ...evidencePrev, notes: additions };
  }

  const { error } = await supabase
    .from("chargebacks")
    .update(update)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.refund",
    resourceType: "chargeback",
    resourceId: id,
    summary: `chargeback 상태 → ${status}`,
    metadata: { status, note, evidenceUrl },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
