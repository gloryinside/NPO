import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/admin/programs/[id]/expenses  — 사업 집행 내역
 * POST /api/admin/programs/[id]/expenses  — 집행 등록
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: programId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("program_expenses")
    .select(
      "id, expense_date, amount, description, vendor, receipt_url, approved_by, approved_at, budget_item_id, program_budget_items(category, item_name)"
    )
    .eq("org_id", tenant.id)
    .eq("program_id", programId)
    .order("expense_date", { ascending: false })
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id: programId } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const expenseDate = typeof body.expenseDate === "string" ? body.expenseDate : "";
  const amount = Number(body.amount ?? NaN);
  const description = typeof body.description === "string" ? body.description.trim() : "";
  if (!expenseDate || !(amount >= 0) || !description) {
    return NextResponse.json(
      { error: "expenseDate, amount, description 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("program_expenses")
    .insert({
      org_id: tenant.id,
      program_id: programId,
      budget_item_id: typeof body.budgetItemId === "string" ? body.budgetItemId : null,
      expense_date: expenseDate,
      amount,
      description,
      vendor: typeof body.vendor === "string" ? body.vendor : null,
      receipt_url: typeof body.receiptUrl === "string" ? body.receiptUrl : null,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
