import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildRevenueJournal } from "@/lib/erp/revenue-journal";
import { readJsonObject } from "@/lib/http/body";

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const status = req.nextUrl.searchParams.get("status");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("revenue_journals")
    .select("id, journal_no, journal_date, description, total_amount, payment_count, status, posted_to_erp_at, external_voucher_no, created_at")
    .eq("org_id", tenant.id)
    .order("journal_date", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

/**
 * POST /api/admin/revenue-journals
 *   body: { journalDate, periodStart?, periodEnd?, unitId?, description? }
 *   confirmed payments을 묶어 결의 1건 자동 생성.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const journalDate = typeof body.journalDate === "string"
    ? body.journalDate
    : new Date().toISOString().slice(0, 10);

  const supabase = createSupabaseAdminClient();
  const result = await buildRevenueJournal(supabase, {
    orgId: tenant.id,
    journalDate,
    periodStart: typeof body.periodStart === "string" ? body.periodStart : undefined,
    periodEnd: typeof body.periodEnd === "string" ? body.periodEnd : undefined,
    unitId: typeof body.unitId === "string" ? body.unitId : undefined,
    description: typeof body.description === "string" ? body.description : undefined,
    createdBy: user.id,
  });

  if (!result.ok) {
    const status = result.error === "PERIOD_CLOSED" ? 400
      : result.error === "NO_PAYMENTS" ? 404
      : 500;
    return NextResponse.json({ error: result.error, message: "message" in result ? result.message : undefined }, { status });
  }
  return NextResponse.json(result);
}
