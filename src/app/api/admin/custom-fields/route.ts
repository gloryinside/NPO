import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

const VALID_ENTITY = new Set(["members", "promises", "payments", "campaigns"]);
const VALID_TYPE = new Set(["text", "number", "date", "select", "multiselect", "boolean"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const entity = req.nextUrl.searchParams.get("entity");

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("custom_field_definitions")
    .select("id, entity_type, field_key, label, description, field_type, options, required, display_order, visible_in_list, visible_to_donor, searchable, active")
    .eq("org_id", tenant.id)
    .order("entity_type")
    .order("display_order");
  if (entity && VALID_ENTITY.has(entity)) q = q.eq("entity_type", entity);
  const { data, error } = await q;
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

  const entityType = typeof body.entityType === "string" ? body.entityType : "";
  const fieldKey = typeof body.fieldKey === "string" ? body.fieldKey.trim() : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const fieldType = typeof body.fieldType === "string" ? body.fieldType : "";

  if (!VALID_ENTITY.has(entityType) || !label || !VALID_TYPE.has(fieldType)) {
    return NextResponse.json({ error: "entityType, label, fieldType 필수" }, { status: 400 });
  }
  if (!/^[a-z][a-z0-9_]{1,49}$/.test(fieldKey)) {
    return NextResponse.json({ error: "fieldKey: 영소문자 시작, 영소문자/숫자/언더바 2~50자" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("custom_field_definitions")
    .insert({
      org_id: tenant.id,
      entity_type: entityType,
      field_key: fieldKey,
      label,
      description: typeof body.description === "string" ? body.description : null,
      field_type: fieldType,
      options: Array.isArray(body.options) ? body.options : null,
      required: body.required === true,
      display_order: Number.isInteger(body.displayOrder) ? body.displayOrder : 100,
      visible_in_list: body.visibleInList === true,
      visible_to_donor: body.visibleToDonor === true,
      searchable: body.searchable === true,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 존재하는 fieldKey" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
