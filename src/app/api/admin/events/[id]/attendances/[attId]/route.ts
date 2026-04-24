import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_STATUS = new Set(["registered", "checked_in", "no_show", "cancelled"]);

/**
 * PATCH /api/admin/events/[id]/attendances/[attId]
 *   상태 전환 (체크인/노쇼/취소)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; attId: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { attId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const status = typeof body.status === "string" ? body.status : "";
  if (!VALID_STATUS.has(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const update: Record<string, unknown> = { status };
  if (status === "checked_in") update.checked_in_at = new Date().toISOString();

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("event_attendances")
    .update(update)
    .eq("id", attId)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
