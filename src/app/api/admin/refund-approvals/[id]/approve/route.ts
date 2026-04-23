import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { logAudit } from "@/lib/audit";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { refundPayment } from "@/lib/payments/refund";

/**
 * G-D146: 환불 승인 — 요청자와 다른 admin 이 승인 가능.
 * 승인 후에는 실제 Toss 환불 API 호출 단계로 전환 (별도 lib에서 처리 — 본 라우트는 상태만 전환).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  // G-D150: finance 또는 super 역할만 환불 승인 가능
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json(
      { error: "finance 또는 super 역할이 필요합니다." },
      { status: 403 }
    );
  }

  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("refund_approvals")
    .select("id, status, requested_by, payment_id, amount, reason")
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
  if (row.requested_by === user.id) {
    return NextResponse.json(
      { error: "요청자 본인은 승인할 수 없습니다." },
      { status: 403 }
    );
  }

  // 1) approved 로 전환
  const nowIso = new Date().toISOString();
  {
    const { error } = await supabase
      .from("refund_approvals")
      .update({
        status: "approved",
        approved_by: user.id,
        approved_by_email: user.email ?? null,
        updated_at: nowIso,
      })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 2) 실제 Toss 환불 호출
  const exec = await refundPayment({
    supabase,
    orgId: tenant.id,
    paymentId: row.payment_id,
    reasonCode: "donor_request",
    reasonNote: row.reason ?? undefined,
    refundAmount: row.amount,
  });

  if (!exec.ok) {
    await supabase
      .from("refund_approvals")
      .update({
        status: "failed",
        rejected_reason: `toss 실행 실패: ${exec.error}`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    return NextResponse.json(
      { error: "환불 실행 실패", detail: exec.error },
      { status: 502 }
    );
  }

  await supabase
    .from("refund_approvals")
    .update({
      status: "executed",
      executed_at: new Date().toISOString(),
    })
    .eq("id", id);

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.refund",
    resourceType: "refund_approval",
    resourceId: id,
    summary: `환불 실행 (${row.amount.toLocaleString()}원)`,
    metadata: { paymentId: row.payment_id, executed: true },
  }).catch(() => {});

  return NextResponse.json({ ok: true, executed: true });
}
