import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// GET /api/board?type=notice|faq&category=payment — 공개 게시판 (인증 불필요)
export async function GET(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "faq" ? "faq" : "notice";
  const category = searchParams.get("category");

  const admin = createSupabaseAdminClient();
  let q = admin
    .from("board_posts")
    .select("id, post_type, category, title, body, pinned, published_at, created_at")
    .eq("org_id", tenant.id)
    .eq("post_type", type)
    .eq("published", true)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false })
    .limit(100);

  if (category) q = q.eq("category", category);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}
