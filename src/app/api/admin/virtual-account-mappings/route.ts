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
    .from("virtual_account_mappings")
    .select("id, virtual_account_pattern, pg_method, bank_account_id, priority, active, bank_accounts(bank_name, account_no)")
    .eq("org_id", tenant.id)
    .order("priority");
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

  const bankAccountId = typeof body.bankAccountId === "string" ? body.bankAccountId : "";
  if (!bankAccountId) return NextResponse.json({ error: "bankAccountId 필수" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("virtual_account_mappings")
    .insert({
      org_id: tenant.id,
      virtual_account_pattern: typeof body.virtualAccountPattern === "string" ? body.virtualAccountPattern : null,
      pg_method: typeof body.pgMethod === "string" ? body.pgMethod : null,
      bank_account_id: bankAccountId,
      priority: Number.isInteger(body.priority) ? body.priority : 100,
      active: body.active !== false,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
