import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const { id } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") update.title = body.title.trim();
  if (typeof body.story === "string") update.story = body.story.slice(0, 5000);
  if (typeof body.goalAmount === "number") update.goal_amount = body.goalAmount;
  if (typeof body.coverImageUrl === "string") update.cover_image_url = body.coverImageUrl;
  if (body.status === "closed" || body.status === "active") {
    update.status = body.status;
    if (body.status === "closed") update.closed_at = new Date().toISOString().slice(0, 10);
  }

  const supabase = createSupabaseAdminClient();
  // 본인 소유 확인 + 갱신
  const { data, error } = await supabase
    .from("p2p_pages")
    .update(update)
    .eq("id", id)
    .eq("org_id", session.member.org_id)
    .eq("owner_member_id", session.member.id)
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "권한 없음" }, { status: 403 });
  return NextResponse.json({ ok: true });
}
