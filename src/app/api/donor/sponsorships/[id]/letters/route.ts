import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { LETTERS_PER_DAY, parseLetterText, toDonorLetters } from "@/lib/sponsorship/letters";

type RouteContext = { params: Promise<{ id: string }> };

/** 로그인한 후원자 본인의 결연인지 */
async function ownSponsorship(id: string, orgId: string, memberId: string) {
  const { data } = await createSupabaseAdminClient()
    .from("sponsorships")
    .select("id, status")
    .eq("id", id)
    .eq("org_id", orgId)
    .eq("sponsor_member_id", memberId)
    .maybeSingle();
  return data as { id: string; status: string } | null;
}

/**
 * GET  /api/donor/sponsorships/[id]/letters — 주고받은 편지(아이 편지는 전달된 것만)
 * POST /api/donor/sponsorships/[id]/letters — 아이에게 편지 쓰기 { text }. 기관이 확인한 뒤 전달한다.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { id } = await params;
  const own = await ownSponsorship(id, session.member.org_id, session.member.id);
  if (!own) return NextResponse.json({ error: "결연을 찾을 수 없습니다." }, { status: 404 });

  const { data, error } = await createSupabaseAdminClient()
    .from("sponsor_letters")
    .select("id, direction, original_text, translated_text, status, rejection_reason, created_at, delivered_at")
    .eq("org_id", session.member.org_id)
    .eq("sponsorship_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "편지를 불러오지 못했습니다." }, { status: 500 });
  return NextResponse.json({ letters: toDonorLetters(data ?? []) });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const rl = enforceDonorLimit(session.member.id, "sponsor-letter:post");
  if (!rl.allowed) return limitResponse(rl);

  const { id } = await params;
  const own = await ownSponsorship(id, session.member.org_id, session.member.id);
  if (!own) return NextResponse.json({ error: "결연을 찾을 수 없습니다." }, { status: 404 });
  if (own.status !== "active") {
    return NextResponse.json({ error: "진행 중인 결연에만 편지를 쓸 수 있어요." }, { status: 400 });
  }

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const letter = parseLetterText(parsed.body.text);
  if (!letter.ok) return NextResponse.json({ error: letter.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase
    .from("sponsor_letters")
    .select("id", { count: "exact", head: true })
    .eq("org_id", session.member.org_id)
    .eq("sponsorship_id", id)
    .eq("direction", "to_beneficiary")
    .gte("created_at", since);
  if ((count ?? 0) >= LETTERS_PER_DAY) {
    return NextResponse.json({ error: `편지는 하루에 ${LETTERS_PER_DAY}통까지 보낼 수 있어요.` }, { status: 429 });
  }

  const { data, error } = await supabase
    .from("sponsor_letters")
    .insert({
      org_id: session.member.org_id,
      sponsorship_id: id,
      direction: "to_beneficiary",
      original_text: letter.text,
      status: "received",
    })
    .select("id")
    .single();
  if (error || !data) return NextResponse.json({ error: "편지를 보내지 못했습니다." }, { status: 500 });

  await logAudit({
    orgId: session.member.org_id,
    actorId: null,
    actorEmail: null,
    action: "sponsor_letter.write",
    resourceType: "sponsor_letter",
    resourceId: data.id,
    summary: `후원자(${session.member.id}) 결연 편지 작성`,
  });
  return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
}
