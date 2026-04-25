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
    .from("org_units")
    .select("id, code, name, parent_id, manager_email, active, created_at")
    .eq("org_id", tenant.id)
    .order("code");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 각 unit별 회원/결제 통계
  const ids = (data ?? []).map((u) => u.id);
  let memberCount = new Map<string, number>();
  let paymentSum = new Map<string, number>();
  if (ids.length > 0) {
    const [mRes, pRes] = await Promise.all([
      supabase.from("members").select("unit_id").eq("org_id", tenant.id).in("unit_id", ids),
      supabase.from("payments").select("unit_id, amount")
        .eq("org_id", tenant.id).eq("pay_status", "paid").in("unit_id", ids),
    ]);
    for (const m of (mRes.data ?? []) as Array<{ unit_id: string | null }>) {
      if (!m.unit_id) continue;
      memberCount.set(m.unit_id, (memberCount.get(m.unit_id) ?? 0) + 1);
    }
    for (const p of (pRes.data ?? []) as Array<{ unit_id: string | null; amount: number | null }>) {
      if (!p.unit_id) continue;
      paymentSum.set(p.unit_id, (paymentSum.get(p.unit_id) ?? 0) + Number(p.amount ?? 0));
    }
  }

  return NextResponse.json({
    items: (data ?? []).map((u) => ({
      ...u,
      memberCount: memberCount.get(u.id) ?? 0,
      paymentSum: paymentSum.get(u.id) ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!code || !name) {
    return NextResponse.json({ error: "code, name 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("org_units")
    .insert({
      org_id: tenant.id,
      code, name,
      parent_id: typeof body.parentId === "string" ? body.parentId : null,
      manager_email: typeof body.managerEmail === "string" ? body.managerEmail : null,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 존재하는 code" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
