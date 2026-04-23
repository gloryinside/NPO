import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { logAudit } from "@/lib/audit";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: { reason?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason) {
    return NextResponse.json(
      { error: "반려 사유 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("refund_approvals")
    .select("status")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.status !== "pending") {
    return NextResponse.json(
      { error: `이미 처리됨 (${row.status})` },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from("refund_approvals")
    .update({
      status: "rejected",
      approved_by: user.id,
      approved_by_email: user.email ?? null,
      rejected_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.refund",
    resourceType: "refund_approval",
    resourceId: id,
    summary: `환불 반려: ${reason}`,
    metadata: { rejected: true, reason },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
