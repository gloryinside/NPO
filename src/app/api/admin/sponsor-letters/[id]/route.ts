import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_STATUS = new Set(["received", "translating", "reviewed", "delivered", "rejected"]);

/**
 * PATCH /api/admin/sponsor-letters/[id]
 *   편지 번역/검수/전달 상태 전환.
 *   body: { status, translatedText?, rejectionReason? }
 *   status='reviewed' 면 reviewer + reviewed_at 자동 기록
 *   status='delivered' 면 delivered_at 기록
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
    if (status === "reviewed") {
      update.reviewed_by = user.id;
      update.reviewed_at = new Date().toISOString();
    }
    if (status === "delivered") {
      update.delivered_at = new Date().toISOString();
    }
    if (status === "rejected") {
      update.rejection_reason =
        typeof body.rejectionReason === "string" ? body.rejectionReason : null;
    }
  }
  if (typeof body.translatedText === "string") update.translated_text = body.translatedText;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "수정 항목 없음" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("sponsor_letters")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
