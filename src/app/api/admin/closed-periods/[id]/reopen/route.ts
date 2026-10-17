import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/admin/closed-periods/[id]/reopen
 *   body: { reason: string }
 *   마감된 기간을 다시 열기 (수정/조정 필요 시).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: { reason?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: "재오픈 사유 5자 이상 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("closed_periods")
    .update({
      reopened_at: new Date().toISOString(),
      reopened_by: user.id,
      reopen_reason: reason,
    })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .is("reopened_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
