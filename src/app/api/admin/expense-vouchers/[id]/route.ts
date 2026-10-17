import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const TRANSITIONS: Record<string, string[]> = {
  draft: ["submitted"],
  submitted: ["reviewed", "rejected"],
  reviewed: ["approved", "rejected"],
  approved: ["paid", "rejected"],
  paid: [],
  rejected: ["draft"],
};

/**
 * PATCH /api/admin/expense-vouchers/[id]
 *   결재 흐름 전환: draft → submitted → reviewed → approved → paid
 *   각 단계는 다른 admin이 수행 (4-eyes principle).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const supabase = createSupabaseAdminClient();
  const { data: voucher } = await supabase
    .from("expense_vouchers")
    .select("status, submitted_by, reviewer_id, approver_id")
    .eq("id", id).eq("org_id", tenant.id).maybeSingle();
  if (!voucher) return NextResponse.json({ error: "not found" }, { status: 404 });

  const nextStatus = typeof body.status === "string" ? body.status : "";
  if (!nextStatus) return NextResponse.json({ error: "status 필수" }, { status: 400 });
  const allowed = TRANSITIONS[voucher.status] ?? [];
  if (!allowed.includes(nextStatus)) {
    return NextResponse.json(
      { error: `${voucher.status} → ${nextStatus} 불가` },
      { status: 400 }
    );
  }

  // 같은 사람이 여러 단계 진행 못 함
  if (nextStatus === "reviewed" && voucher.submitted_by === user.id) {
    return NextResponse.json({ error: "제출자 본인은 검토 불가" }, { status: 403 });
  }
  if (nextStatus === "approved" && (voucher.reviewer_id === user.id || voucher.submitted_by === user.id)) {
    return NextResponse.json({ error: "제출/검토자는 승인 불가" }, { status: 403 });
  }

  const update: Record<string, unknown> = { status: nextStatus };
  const now = new Date().toISOString();
  if (nextStatus === "submitted") update.submitted_at = now;
  else if (nextStatus === "reviewed") { update.reviewed_at = now; update.reviewer_id = user.id; }
  else if (nextStatus === "approved") { update.approved_at = now; update.approver_id = user.id; }
  else if (nextStatus === "paid") {
    update.paid_at = now;
    if (typeof body.bankAccountId === "string") update.bank_account_id = body.bankAccountId;
  }
  else if (nextStatus === "rejected") {
    update.rejected_reason = typeof body.rejectedReason === "string" ? body.rejectedReason : null;
  }

  const { error } = await supabase
    .from("expense_vouchers").update(update).eq("id", id).eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
