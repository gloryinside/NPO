import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_PURPOSE = new Set(["main", "virtual_settlement", "cms_settlement", "grant", "other"]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .select("id, bank_name, account_no, account_holder, cash_account_id, purpose, pg_provider, active, chart_of_accounts:cash_account_id(code, name)")
    .eq("org_id", tenant.id)
    .order("bank_name");
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

  const bankName = typeof body.bankName === "string" ? body.bankName.trim() : "";
  const accountNo = typeof body.accountNo === "string" ? body.accountNo.trim() : "";
  if (!bankName || !accountNo) {
    return NextResponse.json({ error: "bankName, accountNo 필수" }, { status: 400 });
  }
  const purpose = typeof body.purpose === "string" && VALID_PURPOSE.has(body.purpose)
    ? body.purpose : "main";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      org_id: tenant.id,
      bank_name: bankName,
      account_no: accountNo,
      account_holder: typeof body.accountHolder === "string" ? body.accountHolder : null,
      cash_account_id: typeof body.cashAccountId === "string" ? body.cashAccountId : null,
      purpose,
      pg_provider: typeof body.pgProvider === "string" ? body.pgProvider : null,
      active: body.active !== false,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이미 존재하는 계좌" }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id });
}
