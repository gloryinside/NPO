import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/admin/volunteer-activities  — 활동 기록 목록
 *   ?volunteerId=...  특정 봉사자만 조회
 *   ?from=YYYY-MM-DD  ?to=YYYY-MM-DD
 * POST /api/admin/volunteer-activities  — 활동 기록 추가
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const sp = req.nextUrl.searchParams;

  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("volunteer_activities")
    .select(
      "id, volunteer_id, activity_date, activity_name, location, hours, campaign_id, external_certified, external_cert_no, notes, members(name)"
    )
    .eq("org_id", tenant.id)
    .order("activity_date", { ascending: false })
    .limit(300);

  const volunteerId = sp.get("volunteerId");
  if (volunteerId) q = q.eq("volunteer_id", volunteerId);
  const from = sp.get("from");
  if (from) q = q.gte("activity_date", from);
  const to = sp.get("to");
  if (to) q = q.lte("activity_date", to);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // hours 합계
  const totalHours = (data ?? []).reduce(
    (acc: number, r: { hours: number | null }) => acc + Number(r.hours ?? 0),
    0
  );
  return NextResponse.json({ items: data ?? [], totalHours });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const volunteerId = typeof body.volunteerId === "string" ? body.volunteerId : "";
  const activityDate = typeof body.activityDate === "string" ? body.activityDate : "";
  const activityName = typeof body.activityName === "string" ? body.activityName.trim() : "";
  const hours = typeof body.hours === "number" ? body.hours : NaN;

  if (!volunteerId || !activityDate || !activityName || !(hours > 0 && hours <= 24)) {
    return NextResponse.json(
      { error: "volunteerId, activityDate, activityName, hours(0~24) 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("volunteer_activities")
    .insert({
      org_id: tenant.id,
      volunteer_id: volunteerId,
      activity_date: activityDate,
      activity_name: activityName,
      location: typeof body.location === "string" ? body.location : null,
      hours,
      campaign_id: typeof body.campaignId === "string" ? body.campaignId : null,
      external_certified: body.externalCertified === true,
      external_cert_no:
        typeof body.externalCertNo === "string" ? body.externalCertNo : null,
      notes: typeof body.notes === "string" ? body.notes : null,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
