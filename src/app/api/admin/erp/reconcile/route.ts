import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAdminRoles } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";
import { pushErpWebhook } from "@/lib/erp/webhook";

const VALID_STATUSES = ["pending", "processing", "confirmed", "excluded"] as const;
type IncomeStatus = (typeof VALID_STATUSES)[number];

/**
 * PATCH /api/admin/erp/reconcile
 * 수입결의 일괄 상태 변경.
 * - 순방향(pending/processing/confirmed/excluded): 모든 admin
 * - 되돌리기(pending): super 전용
 */
export async function PATCH(req: NextRequest) {
  const user = await requireAdminUser();
  const tenant = await requireTenant();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { payment_ids, target_status } = body as {
    payment_ids?: unknown;
    target_status?: unknown;
  };

  if (!Array.isArray(payment_ids) || payment_ids.length === 0) {
    return NextResponse.json({ error: "payment_ids 필수" }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(target_status as IncomeStatus)) {
    return NextResponse.json(
      { error: `target_status: ${VALID_STATUSES.join(", ")} 중 하나` },
      { status: 400 }
    );
  }

  const status = target_status as IncomeStatus;

  // 되돌리기(→ pending)는 super 전용
  if (status === "pending") {
    const { ok, roles } = await getAdminRoles(user.id, tenant.id);
    if (!ok || !roles.includes("super")) {
      return NextResponse.json(
        { error: "되돌리기는 최고 관리자(super)만 가능합니다." },
        { status: 403 }
      );
    }
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("payments")
    .update({ income_status: status, updated_at: new Date().toISOString() })
    .eq("org_id", tenant.id)
    .in("id", payment_ids as string[])
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const updatedIds = (data ?? []).map((r: { id: string }) => r.id);
  const updated = updatedIds.length;

  // Audit log (fire-and-forget)
  logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "payment.confirm_income",
    resourceType: "payment",
    summary: `수입상태 일괄 변경 → ${status} (${updated}건)`,
    metadata: { target_status: status, payment_ids: updatedIds },
  });

  // ERP webhook (fire-and-forget) — 완료 건만 push
  if (status === "confirmed" && updated > 0) {
    for (const id of updatedIds) {
      pushErpWebhook(tenant.id, {
        event: "payment.updated",
        paymentIdx: id,
        paymentCode: "",
        memberCode: "",
        memberName: "",
        payPrice: 0,
        payDate: null,
        incomeStatus: "CONFIRMED",
        occurredAt: new Date().toISOString(),
      });
    }
  }

  return NextResponse.json({ updated });
}
