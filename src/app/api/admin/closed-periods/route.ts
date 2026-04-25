import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("closed_periods")
    .select("id, period_start, period_end, closed_at, closed_by, reopened_at, reopened_by, reopen_reason, notes")
    .eq("org_id", tenant.id)
    .order("period_end", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/closed-periods
 *   body: { periodStart, periodEnd, notes? }
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const periodStart = typeof body.periodStart === "string" ? body.periodStart : "";
  const periodEnd = typeof body.periodEnd === "string" ? body.periodEnd : "";
  if (!periodStart || !periodEnd || periodStart > periodEnd) {
    return NextResponse.json({ error: "periodStart, periodEnd 필수 (start ≤ end)" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("closed_periods")
    .insert({
      org_id: tenant.id,
      period_start: periodStart,
      period_end: periodEnd,
      closed_by: user.id,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 마감된 기간" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
