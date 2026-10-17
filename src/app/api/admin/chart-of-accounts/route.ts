import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_TYPE = new Set(["asset", "liability", "equity", "revenue", "expense"]);
const VALID_KIND = new Set(["designated", "non_designated", "government", "other"]);

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const accountType = req.nextUrl.searchParams.get("type");
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("chart_of_accounts")
    .select("id, code, name, account_type, donation_kind, parent_id, active")
    .eq("org_id", tenant.id)
    .order("code");
  if (accountType && VALID_TYPE.has(accountType)) q = q.eq("account_type", accountType);
  const { data, error } = await q;
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

  const code = typeof body.code === "string" ? body.code.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const accountType = typeof body.accountType === "string" ? body.accountType : "";
  if (!code || !name || !VALID_TYPE.has(accountType)) {
    return NextResponse.json({ error: "code, name, accountType 필수" }, { status: 400 });
  }
  const donationKind = typeof body.donationKind === "string" && VALID_KIND.has(body.donationKind)
    ? body.donationKind : null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("chart_of_accounts")
    .insert({
      org_id: tenant.id,
      code, name, account_type: accountType,
      donation_kind: donationKind,
      parent_id: typeof body.parentId === "string" ? body.parentId : null,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 존재하는 code" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
