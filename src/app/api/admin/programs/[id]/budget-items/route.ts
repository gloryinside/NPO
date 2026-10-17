import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/admin/programs/[id]/budget-items  — 예산 항목 목록 + 카테고리별 집행 합계
 * POST /api/admin/programs/[id]/budget-items  — 예산 항목 추가
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
  const [items, expenses] = await Promise.all([
    supabase
      .from("program_budget_items")
      .select("id, category, item_name, budget_amount, notes")
      .eq("org_id", tenant.id)
      .eq("program_id", programId)
      .order("category"),
    supabase
      .from("program_expenses")
      .select("budget_item_id, amount")
      .eq("org_id", tenant.id)
      .eq("program_id", programId),
  ]);

  if (items.error) {
    return NextResponse.json({ error: items.error.message }, { status: 500 });
  }

  const spent = new Map<string, number>();
  for (const e of (expenses.data ?? []) as Array<{
    budget_item_id: string | null;
    amount: number | null;
  }>) {
    if (!e.budget_item_id) continue;
    spent.set(e.budget_item_id, (spent.get(e.budget_item_id) ?? 0) + Number(e.amount ?? 0));
  }

  return NextResponse.json({
    items: (items.data ?? []).map((it) => ({
      ...it,
      spent: spent.get(it.id) ?? 0,
      remaining: Number(it.budget_amount ?? 0) - (spent.get(it.id) ?? 0),
    })),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: programId } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const category = typeof body.category === "string" ? body.category.trim() : "";
  const itemName = typeof body.itemName === "string" ? body.itemName.trim() : "";
  const budgetAmount = Number(body.budgetAmount ?? NaN);
  if (!category || !itemName || !(budgetAmount >= 0)) {
    return NextResponse.json(
      { error: "category, itemName, budgetAmount 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("program_budget_items")
    .insert({
      org_id: tenant.id,
      program_id: programId,
      category,
      item_name: itemName,
      budget_amount: budgetAmount,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
