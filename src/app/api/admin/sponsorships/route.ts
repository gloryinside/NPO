import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

const VALID_STATUS = new Set(["active", "paused", "ended"]);

/**
 * GET  /api/admin/sponsorships?sponsorMemberId=...&beneficiaryId=...
 * POST /api/admin/sponsorships  — 결연 매칭 생성
 *   생성 시 beneficiaries.status='available' → 'sponsored' 자동 전환.
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("sponsorships")
    .select(
      "id, sponsor_member_id, beneficiary_id, promise_id, start_date, end_date, monthly_amount, status, members(name), beneficiaries(code, name)"
    )
    .eq("org_id", tenant.id)
    .order("start_date", { ascending: false })
    .limit(300);
  const sponsor = sp.get("sponsorMemberId");
  if (sponsor) q = q.eq("sponsor_member_id", sponsor);
  const ben = sp.get("beneficiaryId");
  if (ben) q = q.eq("beneficiary_id", ben);
  const status = sp.get("status");
  if (status && VALID_STATUS.has(status)) q = q.eq("status", status);

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

  const sponsorMemberId = typeof body.sponsorMemberId === "string" ? body.sponsorMemberId : "";
  const beneficiaryId = typeof body.beneficiaryId === "string" ? body.beneficiaryId : "";
  const startDate = typeof body.startDate === "string"
    ? body.startDate
    : new Date().toISOString().slice(0, 10);
  if (!sponsorMemberId || !beneficiaryId) {
    return NextResponse.json(
      { error: "sponsorMemberId, beneficiaryId 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sponsorships")
    .insert({
      org_id: tenant.id,
      sponsor_member_id: sponsorMemberId,
      beneficiary_id: beneficiaryId,
      promise_id: typeof body.promiseId === "string" ? body.promiseId : null,
      start_date: startDate,
      monthly_amount: typeof body.monthlyAmount === "number" ? body.monthlyAmount : null,
      status: "active",
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 동일 시작일 결연 존재" },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 수혜자 상태 sponsored 로 자동 전환 (이미 sponsored 면 영향 없음)
  await supabase
    .from("beneficiaries")
    .update({ status: "sponsored", updated_at: new Date().toISOString() })
    .eq("id", beneficiaryId)
    .eq("org_id", tenant.id)
    .eq("status", "available");

  return NextResponse.json({ id: data?.id });
}
