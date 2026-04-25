import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string") update.name = body.name;
  if (typeof body.description === "string") update.description = body.description;
  if (typeof body.active === "boolean") update.active = body.active;
  if (Array.isArray(body.conditions)) update.conditions = body.conditions;
  if (Array.isArray(body.actions)) update.actions = body.actions;
  if (typeof body.cooldownMinutes === "number") update.cooldown_minutes = body.cooldownMinutes;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("automation_rules")
    .update(update)
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("automation_rules")
    .delete()
    .eq("id", id)
    .eq("org_id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
