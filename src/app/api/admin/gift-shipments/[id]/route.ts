import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_STATUS = new Set(["queued", "preparing", "shipped", "skipped"]);

/**
 * PATCH /api/admin/gift-shipments/[id]
 *   상태 전환 + 발송 정보 입력
 *   body: { status, shippingAddress?, trackingNo?, notes? }
 *   status='shipped' 면 shipped_at 기록 + shipped_by 자동 설정
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = {};
  const status = typeof body.status === "string" ? body.status : null;
  if (status) {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "shipped") {
      update.shipped_at = new Date().toISOString();
      update.shipped_by = user.id;
    }
  }
  if (typeof body.shippingAddress === "string") update.shipping_address = body.shippingAddress;
  if (typeof body.trackingNo === "string") update.tracking_no = body.trackingNo;
  if (typeof body.notes === "string") update.notes = body.notes;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정할 항목 없음" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("gift_shipments")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
