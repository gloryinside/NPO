import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/admin/programs?year=2026[&status=active]
 * POST /api/admin/programs  — 신규 사업 생성
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get("year") ?? new Date().getFullYear());
  const status = sp.get("status");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("programs")
    .select("id, name, code, fiscal_year, budget_total, status, start_date, end_date")
    .eq("org_id", tenant.id)
    .eq("fiscal_year", year)
    .order("name");
  if (status) q = q.eq("status", status);

  const { data: programs, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 각 프로그램별 집행 합계
  const ids = (programs ?? []).map((p) => p.id);
  let spentByProgram = new Map<string, number>();
  if (ids.length) {
    const { data: exp } = await supabase
      .from("program_expenses")
      .select("program_id, amount")
      .eq("org_id", tenant.id)
      .in("program_id", ids);
    spentByProgram = new Map();
    for (const e of (exp ?? []) as Array<{ program_id: string; amount: number | null }>) {
      spentByProgram.set(
        e.program_id,
        (spentByProgram.get(e.program_id) ?? 0) + Number(e.amount ?? 0)
      );
    }
  }

  return NextResponse.json({
    items: (programs ?? []).map((p) => ({
      ...p,
      spent: spentByProgram.get(p.id) ?? 0,
      remaining: Number(p.budget_total ?? 0) - (spentByProgram.get(p.id) ?? 0),
    })),
  });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const fiscalYear = Number(body.fiscalYear ?? NaN);
  if (!name || !Number.isInteger(fiscalYear) || fiscalYear < 2000) {
    return NextResponse.json({ error: "name, fiscalYear 필수" }, { status: 400 });
  }

  const insert: Record<string, unknown> = {
    org_id: tenant.id,
    name,
    fiscal_year: fiscalYear,
    code: typeof body.code === "string" ? body.code : null,
    description: typeof body.description === "string" ? body.description : null,
    budget_total: typeof body.budgetTotal === "number" ? body.budgetTotal : 0,
    status: typeof body.status === "string" ? body.status : "planning",
    start_date: typeof body.startDate === "string" ? body.startDate : null,
    end_date: typeof body.endDate === "string" ? body.endDate : null,
    manager_id: typeof body.managerId === "string" ? body.managerId : null,
  };

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("programs")
    .insert(insert)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
