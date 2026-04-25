import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { authenticateV1 } from "@/lib/erp/v1-auth";

/**
 * GET /api/v1/members  — ERP가 회원 마스터 조회 (거래처 동기화용)
 *   ?changedSince=YYYY-MM-DD  변경 회원만 (created_at OR updated_at >= since)
 *   ?count=100&offset=0
 *
 * PATCH /api/v1/members?memberCode=...  — ERP가 bp_code 등록/갱신
 *   body: { bpCode }
 */
export async function GET(req: NextRequest) {
  const authResult = await authenticateV1(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const orgId = authResult.orgId;
  const sp = req.nextUrl.searchParams;
  const changedSince = sp.get("changedSince");
  const count = Math.min(Number(sp.get("count") ?? 100), 1000);
  const offset = Number(sp.get("offset") ?? 0);

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("members")
    .select(
      "id, member_code, name, member_type, email, phone, bp_code, business_reg_no, corp_legal_name, status, created_at, updated_at",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("updated_at", { ascending: false })
    .range(offset, offset + count - 1);
  if (changedSince) q = q.gte("updated_at", changedSince);

  const { data, error, count: total } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [], total: total ?? 0, count, offset });
}

export async function PATCH(req: NextRequest) {
  const authResult = await authenticateV1(req);
  if ("error" in authResult) {
    return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  }
  const orgId = authResult.orgId;
  const memberCode = req.nextUrl.searchParams.get("memberCode");
  if (!memberCode) return NextResponse.json({ error: "memberCode required" }, { status: 400 });

  let body: { bpCode?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const bpCode = typeof body.bpCode === "string" ? body.bpCode.trim() : "";
  if (!bpCode) return NextResponse.json({ error: "bpCode required" }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("members")
    .update({
      bp_code: bpCode,
      bp_synced_at: new Date().toISOString(),
    })
    .eq("org_id", orgId)
    .eq("member_code", memberCode)
    .select("id, member_code, bp_code")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "member not found" }, { status: 404 });
  return NextResponse.json(data);
}
