import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type PromiseStatEntry = {
  promise_id: string;
  total_paid: number;
  paid_count: number;
  failed_count: number;
  history_12m: Array<{ month: string; status: "paid" | "failed" | "none" }>;
};

/**
 * GET /api/donor/promises
 *
 * 후원자의 모든 약정 + 캠페인 정보(impact 단위 포함) + 누적 통계·최근 12개월 히스토리.
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const [{ data: rows, error }, { data: statsRaw }] = await Promise.all([
    supabase
      .from("promises")
      .select(
        "*, campaigns(id, title, impact_unit_amount, impact_unit_label)"
      )
      .eq("org_id", session.member.org_id)
      .eq("member_id", session.member.id)
      .order("created_at", { ascending: false }),
    supabase.rpc("get_donor_promise_stats", {
      p_org_id: session.member.org_id,
      p_member_id: session.member.id,
    }),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const statsArr = (statsRaw as PromiseStatEntry[] | null) ?? [];
  const statsById = new Map(statsArr.map((s) => [s.promise_id, s]));

  const promises = (rows ?? []).map((p) => ({
    ...p,
    stats: statsById.get(p.id) ?? {
      promise_id: p.id,
      total_paid: 0,
      paid_count: 0,
      failed_count: 0,
      history_12m: [],
    },
  }));

  return NextResponse.json({ promises });
}
