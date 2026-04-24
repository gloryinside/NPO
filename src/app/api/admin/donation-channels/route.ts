import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_TYPES = new Set(["box", "street", "booth", "online", "partner", "other"]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("donation_channels")
    .select("id, code, name, channel_type, location, manager_name, active_from, active_to, active")
    .eq("org_id", tenant.id)
    .order("name");
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

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const channelType = typeof body.channelType === "string" ? body.channelType : "";
  if (!code || !name || !VALID_TYPES.has(channelType)) {
    return NextResponse.json(
      { error: "code, name, channelType 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("donation_channels")
    .insert({
      org_id: tenant.id,
      code, name, channel_type: channelType,
      location: typeof body.location === "string" ? body.location : null,
      manager_name: typeof body.managerName === "string" ? body.managerName : null,
      manager_phone: typeof body.managerPhone === "string" ? body.managerPhone : null,
      active_from: typeof body.activeFrom === "string" ? body.activeFrom : null,
      active_to: typeof body.activeTo === "string" ? body.activeTo : null,
      active: body.active !== false,
      notes: typeof body.notes === "string" ? body.notes : null,
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
