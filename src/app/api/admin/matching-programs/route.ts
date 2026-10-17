import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("matching_programs")
    .select(
      "id, name, corporate_member_id, match_ratio, per_donor_annual_cap, total_annual_cap, active, active_from, active_to, contact_email, members(name)"
    )
    .eq("org_id", tenant.id)
    .order("name");
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

  const corporateMemberId = typeof body.corporateMemberId === "string" ? body.corporateMemberId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const matchRatio = Number(body.matchRatio ?? NaN);
  if (!corporateMemberId || !name || !(matchRatio > 0)) {
    return NextResponse.json(
      { error: "corporateMemberId, name, matchRatio(>0) 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("matching_programs")
    .insert({
      org_id: tenant.id,
      corporate_member_id: corporateMemberId,
      name,
      match_ratio: matchRatio,
      per_donor_annual_cap:
        typeof body.perDonorAnnualCap === "number" ? body.perDonorAnnualCap : null,
      total_annual_cap:
        typeof body.totalAnnualCap === "number" ? body.totalAnnualCap : null,
      active: body.active !== false,
      active_from: typeof body.activeFrom === "string" ? body.activeFrom : null,
      active_to: typeof body.activeTo === "string" ? body.activeTo : null,
      contact_email: typeof body.contactEmail === "string" ? body.contactEmail : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
