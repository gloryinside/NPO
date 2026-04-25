import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/donor/p2p-pages         — 내 P2P 페이지 목록
 * POST /api/donor/p2p-pages         — 새 P2P 페이지 생성
 *   body: { campaignId, slug, title, story?, goalAmount?, coverImageUrl? }
 */
export async function GET() {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("p2p_pages")
    .select("id, campaign_id, slug, title, goal_amount, status, created_at, campaigns(slug, title)")
    .eq("org_id", session.member.org_id)
    .eq("owner_member_id", session.member.id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 페이지별 모금 합계
  const ids = (data ?? []).map((p) => p.id);
  let totals = new Map<string, { sum: number; count: number }>();
  if (ids.length > 0) {
    const { data: pays } = await supabase
      .from("payments")
      .select("p2p_page_id, amount")
      .eq("org_id", session.member.org_id)
      .eq("pay_status", "paid")
      .in("p2p_page_id", ids);
    totals = new Map();
    for (const p of (pays ?? []) as Array<{ p2p_page_id: string | null; amount: number | null }>) {
      if (!p.p2p_page_id) continue;
      const cur = totals.get(p.p2p_page_id) ?? { sum: 0, count: 0 };
      cur.sum += Number(p.amount ?? 0);
      cur.count++;
      totals.set(p.p2p_page_id, cur);
    }
  }

  return NextResponse.json({
    items: (data ?? []).map((p) => ({
      ...p,
      raised: totals.get(p.id)?.sum ?? 0,
      supporter_count: totals.get(p.id)?.count ?? 0,
    })),
  });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const campaignId = typeof body.campaignId === "string" ? body.campaignId : "";
  const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!campaignId || !slug || !title) {
    return NextResponse.json({ error: "campaignId, slug, title 필수" }, { status: 400 });
  }
  if (!/^[a-z0-9][a-z0-9-]{2,49}$/.test(slug)) {
    return NextResponse.json({ error: "slug는 3~50자 영소문자/숫자/하이픈" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  // 캠페인 존재 + 동일 org 검증
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status")
    .eq("id", campaignId)
    .eq("org_id", session.member.org_id)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없음" }, { status: 404 });

  const { data, error } = await supabase
    .from("p2p_pages")
    .insert({
      org_id: session.member.org_id,
      campaign_id: campaignId,
      owner_member_id: session.member.id,
      slug,
      title,
      story: typeof body.story === "string" ? body.story.slice(0, 5000) : null,
      goal_amount: typeof body.goalAmount === "number" ? body.goalAmount : null,
      cover_image_url: typeof body.coverImageUrl === "string" ? body.coverImageUrl : null,
      status: "active",
    })
    .select("id, slug")
    .maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 사용 중인 slug" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data?.id, slug: data?.slug });
}
