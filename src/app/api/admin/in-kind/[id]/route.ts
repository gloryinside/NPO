import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_STATUS = new Set(["pending", "appraised", "accepted", "rejected"]);

/**
 * PATCH /api/admin/in-kind/[id]
 *   상태 전이 (평가/수락/반려) + 평가가 입력
 *   body: {
 *     status?: 'appraised' | 'accepted' | 'rejected',
 *     appraisedValue?: number,
 *     rejectedReason?: string,
 *   }
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

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const status = typeof body.status === "string" ? body.status : null;
  if (status) {
    if (!VALID_STATUS.has(status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    update.status = status;
    if (status === "appraised") {
      const v = body.appraisedValue;
      if (typeof v !== "number" || v < 0) {
        return NextResponse.json({ error: "appraisedValue 필수" }, { status: 400 });
      }
      update.appraised_value = v;
      update.appraised_by = user.id;
      update.appraised_at = new Date().toISOString();
    }
    if (status === "rejected") {
      update.rejected_reason =
        typeof body.rejectedReason === "string" ? body.rejectedReason : null;
    }
  }

  if (typeof body.appraisedValue === "number" && body.appraisedValue >= 0 && !status) {
    update.appraised_value = body.appraisedValue;
    update.appraised_by = user.id;
    update.appraised_at = new Date().toISOString();
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("in_kind_donations")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("*")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ donation: data });
}
