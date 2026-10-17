import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/donor/events/[id]/register
 *
 * 후원자가 본인을 행사에 등록 (member_id=본인). status='registered'.
 * - event.status='open' 만 허용
 * - capacity 가 있으면 현재 등록자 수와 비교 (party_size 고려)
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { id: eventId } = await params;

  let body: { partySize?: unknown; notes?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }
  const partySize = Number.isInteger(body.partySize) && (body.partySize as number) > 0
    ? (body.partySize as number) : 1;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : null;

  const supabase = createSupabaseAdminClient();
  const { data: event } = await supabase
    .from("events")
    .select("id, capacity, status, registration_deadline")
    .eq("id", eventId)
    .eq("org_id", session.member.org_id)
    .maybeSingle();

  if (!event) return NextResponse.json({ error: "행사를 찾을 수 없습니다." }, { status: 404 });
  if (event.status !== "open") {
    return NextResponse.json({ error: "신청이 열려있지 않은 행사입니다." }, { status: 400 });
  }
  if (event.registration_deadline && new Date(event.registration_deadline) < new Date()) {
    return NextResponse.json({ error: "신청 마감일이 지났습니다." }, { status: 400 });
  }

  // 중복 등록 방지
  const { data: existing } = await supabase
    .from("event_attendances")
    .select("id, status")
    .eq("org_id", session.member.org_id)
    .eq("event_id", eventId)
    .eq("member_id", session.member.id)
    .in("status", ["registered", "checked_in"])
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "이미 신청하셨습니다." }, { status: 409 });
  }

  // 정원 체크
  if (event.capacity != null) {
    const { data: atts } = await supabase
      .from("event_attendances")
      .select("party_size")
      .eq("org_id", session.member.org_id)
      .eq("event_id", eventId)
      .in("status", ["registered", "checked_in"]);
    const occupied = (atts ?? []).reduce(
      (acc: number, r: { party_size: number | null }) => acc + Number(r.party_size ?? 1),
      0
    );
    if (occupied + partySize > event.capacity) {
      return NextResponse.json(
        { error: `정원 초과 (현재 ${occupied}/${event.capacity}명)` },
        { status: 400 }
      );
    }
  }

  const { data, error } = await supabase
    .from("event_attendances")
    .insert({
      org_id: session.member.org_id,
      event_id: eventId,
      member_id: session.member.id,
      party_size: partySize,
      status: "registered",
      notes,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
