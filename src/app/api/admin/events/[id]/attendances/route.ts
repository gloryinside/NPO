import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

/**
 * GET  /api/admin/events/[id]/attendances  — 참석자 목록
 * POST /api/admin/events/[id]/attendances  — 참석자 등록 (회원 또는 게스트)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: eventId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("event_attendances")
    .select(
      "id, member_id, guest_name, guest_phone, guest_email, party_size, status, registered_at, checked_in_at, notes, members(name, phone, email)"
    )
    .eq("org_id", tenant.id)
    .eq("event_id", eventId)
    .order("registered_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 통계
  const stats = { registered: 0, checked_in: 0, no_show: 0, cancelled: 0, totalParty: 0 };
  for (const r of (data ?? []) as Array<{ status: string; party_size: number | null }>) {
    if (r.status in stats) (stats as Record<string, number>)[r.status]++;
    stats.totalParty += Number(r.party_size ?? 1);
  }

  return NextResponse.json({ items: data ?? [], stats });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: eventId } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const memberId = typeof body.memberId === "string" ? body.memberId : null;
  const guestName = typeof body.guestName === "string" ? body.guestName.trim() : "";

  if (!memberId && !guestName) {
    return NextResponse.json(
      { error: "memberId 또는 guestName 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("event_attendances")
    .insert({
      org_id: tenant.id,
      event_id: eventId,
      member_id: memberId,
      guest_name: memberId ? null : guestName,
      guest_phone: memberId ? null : (typeof body.guestPhone === "string" ? body.guestPhone : null),
      guest_email: memberId ? null : (typeof body.guestEmail === "string" ? body.guestEmail : null),
      party_size: Number.isInteger(body.partySize) && (body.partySize as number) > 0
        ? body.partySize : 1,
      status: "registered",
      notes: typeof body.notes === "string" ? body.notes : null,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
