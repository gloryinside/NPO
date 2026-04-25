import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/public/p2p/[campaignSlug]/[pageSlug]
 *   공개 P2P 페이지 정보 + 모금 진척도 + 후원자 명단 (display_name+show_amount).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ campaignSlug: string; pageSlug: string }> },
) {
  const { campaignSlug, pageSlug } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, org_id, title")
    .eq("slug", campaignSlug)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ error: "캠페인을 찾을 수 없음" }, { status: 404 });

  const { data: page } = await supabase
    .from("p2p_pages")
    .select(
      "id, slug, title, story, goal_amount, cover_image_url, owner_member_id, members:owner_member_id(name)"
    )
    .eq("campaign_id", campaign.id)
    .eq("slug", pageSlug)
    .eq("status", "active")
    .maybeSingle();
  if (!page) return NextResponse.json({ error: "페이지 없음" }, { status: 404 });

  const [paysRes, supportersRes] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("org_id", campaign.org_id)
      .eq("p2p_page_id", page.id)
      .eq("pay_status", "paid"),
    supabase
      .from("p2p_supporters")
      .select("display_name, amount, message, show_amount, created_at")
      .eq("p2p_page_id", page.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const raised = (paysRes.data ?? []).reduce(
    (acc: number, p: { amount: number | null }) => acc + Number(p.amount ?? 0),
    0,
  );
  const supporterCount = (paysRes.data ?? []).length;

  return NextResponse.json({
    campaign: { slug: campaignSlug, title: campaign.title },
    page: {
      slug: page.slug,
      title: page.title,
      story: page.story,
      goalAmount: page.goal_amount,
      coverImageUrl: page.cover_image_url,
      ownerName: (page as { members?: { name?: string } | null }).members?.name ?? null,
    },
    raised,
    supporterCount,
    progressPercent: page.goal_amount && Number(page.goal_amount) > 0
      ? Math.min(100, (raised / Number(page.goal_amount)) * 100)
      : null,
    recentSupporters: (supportersRes.data ?? []) as Array<{
      display_name: string | null;
      amount: number;
      message: string | null;
      show_amount: boolean;
      created_at: string;
    }>,
  });
}
