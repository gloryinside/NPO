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
    .from("automation_rules")
    .select("id, name, description, trigger_type, conditions, actions, active, cooldown_minutes, last_run_at, run_count")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
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

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const triggerType = typeof body.triggerType === "string" ? body.triggerType : "";
  if (!name || !triggerType) {
    return NextResponse.json({ error: "name, triggerType 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("automation_rules")
    .insert({
      org_id: tenant.id,
      name,
      description: typeof body.description === "string" ? body.description : null,
      trigger_type: triggerType,
      conditions: Array.isArray(body.conditions) ? body.conditions : [],
      actions: Array.isArray(body.actions) ? body.actions : [],
      active: body.active !== false,
      cooldown_minutes:
        Number.isInteger(body.cooldownMinutes) && (body.cooldownMinutes as number) >= 0
          ? body.cooldownMinutes : 60,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
