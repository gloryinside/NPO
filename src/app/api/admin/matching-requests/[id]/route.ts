import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["pending", "approved", "rejected", "fulfilled"]);

/**
 * PATCH /api/admin/matching-requests/[id]
 *   상태 전환 + 매칭 결제 연결.
 *   body: { status, rejectedReason?, matchPaymentId?, approvedByEmail? }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const update: Record<string, unknown> = {};
  const status = typeof body.status === "string" ? body.status : null;
  if (status) {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "approved") {
      update.approved_at = new Date().toISOString();
      if (typeof body.approvedByEmail === "string") {
        update.approved_by_email = body.approvedByEmail;
      }
    }
    if (status === "rejected") {
      update.rejected_reason = typeof body.rejectedReason === "string" ? body.rejectedReason : null;
    }
    if (status === "fulfilled") {
      update.fulfilled_at = new Date().toISOString();
      if (typeof body.matchPaymentId === "string") {
        update.match_payment_id = body.matchPaymentId;
      }
    }
  }
  if (typeof body.notes === "string") update.notes = body.notes;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("matching_requests")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
