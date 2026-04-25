import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/donor/volunteer-activities
 *
 * 로그인 후원자(=봉사자) 본인의 활동 이력 + 총 시간.
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("volunteer_activities")
    .select("id, activity_date, activity_name, location, hours, external_certified, external_cert_no")
    .eq("org_id", session.member.org_id)
    .eq("volunteer_id", session.member.id)
    .order("activity_date", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const totalHours = (data ?? []).reduce(
    (acc: number, r: { hours: number | null }) => acc + Number(r.hours ?? 0),
    0
  );
  return NextResponse.json({ items: data ?? [], totalHours });
}
