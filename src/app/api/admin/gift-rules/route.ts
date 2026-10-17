import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_TRIGGERS = new Set(["cumulative_amount", "years_active", "single_payment"]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("gift_rules")
    .select("id, name, trigger_type, trigger_value, gift_name, gift_description, thank_message, active, created_at")
    .eq("org_id", tenant.id)
    .order("trigger_value");
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
  const triggerType = typeof body.triggerType === "string" ? body.triggerType : "";
  const triggerValue = Number(body.triggerValue ?? NaN);
  const giftName = typeof body.giftName === "string" ? body.giftName.trim() : "";

  if (!name || !VALID_TRIGGERS.has(triggerType) || !(triggerValue > 0) || !giftName) {
    return NextResponse.json(
      { error: "name, triggerType, triggerValue(>0), giftName 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("gift_rules")
    .insert({
      org_id: tenant.id,
      name,
      trigger_type: triggerType,
      trigger_value: triggerValue,
      gift_name: giftName,
      gift_description: typeof body.giftDescription === "string" ? body.giftDescription : null,
      thank_message: typeof body.thankMessage === "string" ? body.thankMessage : null,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
