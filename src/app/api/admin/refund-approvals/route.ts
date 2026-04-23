import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { logAudit } from "@/lib/audit";

/**
 * G-D146: 환불 승인 워크플로.
 *
 * GET  /api/admin/refund-approvals?status=pending
 * POST /api/admin/refund-approvals   (승인 요청 생성)
 *   body: { paymentId, amount, reason? }
 */
const STATUS_WHITELIST = new Set([
  "pending",
  "approved",
  "rejected",
  "executed",
  "failed",
]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();

  let q = supabase
    .from("refund_approvals")
    .select(
      "id, payment_id, requested_by, requested_by_email, amount, reason, status, approved_by, approved_by_email, rejected_reason, executed_at, created_at, payments(payment_code, member_id, members(name))"
    )
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status && STATUS_WHITELIST.has(status)) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  let body: { paymentId?: unknown; amount?: unknown; reason?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const paymentId = typeof body.paymentId === "string" ? body.paymentId : "";
  const amount = Number(body.amount);
  const reason = typeof body.reason === "string" ? body.reason : null;
  if (!paymentId || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: "paymentId, amount 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  // 대상 결제 검증
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount, pay_status, refund_amount")
    .eq("id", paymentId)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!payment) {
    return NextResponse.json(
      { error: "payment not found" },
      { status: 404 }
    );
  }
  if (payment.pay_status !== "paid") {
    return NextResponse.json(
      { error: "paid 상태의 결제만 환불 가능" },
      { status: 400 }
    );
  }
  const alreadyRefunded = Number(payment.refund_amount ?? 0);
  if (amount + alreadyRefunded > Number(payment.amount)) {
    return NextResponse.json(
      { error: "요청 금액이 결제 금액을 초과합니다." },
      { status: 400 }
    );
  }

  const { data: inserted, error } = await supabase
    .from("refund_approvals")
    .insert({
      org_id: tenant.id,
      payment_id: paymentId,
      requested_by: user.id,
      requested_by_email: user.email ?? null,
      amount,
      reason,
      status: "pending",
    })
    .select("id")
    .maybeSingle();
  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "insert 실패" },
      { status: 500 }
    );
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.refund",
    resourceType: "refund_approval",
    resourceId: inserted.id as string,
    summary: `환불 승인 요청 (${amount.toLocaleString()}원)`,
    metadata: { paymentId, amount, reason },
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: inserted.id });
}
