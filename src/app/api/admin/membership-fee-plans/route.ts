import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_CYCLE = new Set(["annual", "monthly", "one_time"]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("membership_fee_plans")
    .select("id, name, fee_amount, cycle, active, description")
    .eq("org_id", tenant.id).order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const feeAmount = Number(body.feeAmount ?? NaN);
  const cycle = typeof body.cycle === "string" ? body.cycle : "";
  if (!name || !(feeAmount > 0) || !VALID_CYCLE.has(cycle)) {
    return NextResponse.json({ error: "name, feeAmount(>0), cycle 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("membership_fee_plans")
    .insert({
      org_id: tenant.id,
      name, fee_amount: feeAmount, cycle,
      description: typeof body.description === "string" ? body.description : null,
      active: body.active !== false,
    })
    .select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 존재하는 이름" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
