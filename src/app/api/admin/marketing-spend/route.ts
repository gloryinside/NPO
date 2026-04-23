import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D161: 월별 마케팅 지출 입력 / 조회.
 *
 * GET  /api/admin/marketing-spend?year=2026
 * POST /api/admin/marketing-spend
 *   body: { year, month, amount, note? } — upsert (month 단위)
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const yearRaw = req.nextUrl.searchParams.get("year");
  const year = yearRaw ? Number(yearRaw) : new Date().getFullYear();

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("org_marketing_spend")
    .select("year, month, amount, note, updated_at")
    .eq("org_id", guard.ctx.tenant.id)
    .eq("year", year)
    .order("month", { ascending: true });

  return NextResponse.json({ year, items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  let body: { year?: unknown; month?: unknown; amount?: unknown; note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const year = Number(body.year);
  const month = Number(body.month);
  const amount = Number(body.amount);
  const note = typeof body.note === "string" ? body.note : null;
  if (
    !Number.isFinite(year) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isFinite(month) ||
    month < 1 ||
    month > 12 ||
    !Number.isFinite(amount) ||
    amount < 0
  ) {
    return NextResponse.json({ error: "invalid input" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("org_marketing_spend").upsert(
    {
      org_id: guard.ctx.tenant.id,
      year,
      month,
      amount,
      note,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,year,month" }
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
