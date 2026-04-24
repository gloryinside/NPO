import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/donor/sponsorships
 *
 * 로그인한 후원자의 활성 결연 목록 + 수혜자 정보 + 최근 근황/편지.
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const { data: sponsorships, error } = await supabase
    .from("sponsorships")
    .select(
      "id, beneficiary_id, start_date, end_date, monthly_amount, status, beneficiaries(id, code, name, birth_year, region, photo_url, bio)"
    )
    .eq("org_id", session.member.org_id)
    .eq("sponsor_member_id", session.member.id)
    .order("start_date", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 각 수혜자의 최근 근황 1건씩 조회
  const beneficiaryIds = Array.from(
    new Set((sponsorships ?? []).map((s) => s.beneficiary_id).filter(Boolean))
  ) as string[];

  let updatesByBen = new Map<string, {
    id: string; update_date: string; title: string | null; body: string | null;
  }>();
  if (beneficiaryIds.length > 0) {
    const { data: updates } = await supabase
      .from("beneficiary_updates")
      .select("id, beneficiary_id, update_date, title, body")
      .eq("org_id", session.member.org_id)
      .in("beneficiary_id", beneficiaryIds)
      .in("visibility", ["sponsors_only", "public"])
      .order("update_date", { ascending: false });

    updatesByBen = new Map();
    for (const u of (updates ?? []) as Array<{
      id: string; beneficiary_id: string; update_date: string; title: string | null; body: string | null;
    }>) {
      if (!updatesByBen.has(u.beneficiary_id)) {
        updatesByBen.set(u.beneficiary_id, {
          id: u.id, update_date: u.update_date, title: u.title, body: u.body,
        });
      }
    }
  }

  return NextResponse.json({
    items: (sponsorships ?? []).map((s) => ({
      ...s,
      latest_update: updatesByBen.get(s.beneficiary_id) ?? null,
    })),
  });
}
