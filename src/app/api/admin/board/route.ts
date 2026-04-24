import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const TYPES = ["notice", "faq"] as const;

// GET /api/admin/board?type=notice
export async function GET(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { searchParams } = new URL(req.url);
  const type = TYPES.includes(searchParams.get("type") as typeof TYPES[number])
    ? searchParams.get("type")!
    : "notice";

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("board_posts")
    .select("id, post_type, category, title, pinned, published, published_at, created_at")
    .eq("org_id", tenant.id)
    .eq("post_type", type)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data });
}

// POST /api/admin/board
export async function POST(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: { post_type?: unknown; category?: unknown; title?: unknown; body?: unknown; pinned?: unknown; published?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const post_type = TYPES.includes(body.post_type as typeof TYPES[number])
    ? (body.post_type as string)
    : null;
  if (!post_type) return NextResponse.json({ error: "유형을 선택하세요." }, { status: 400 });

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!title || title.length > 300) return NextResponse.json({ error: "제목을 입력하세요. (300자 이하)" }, { status: 400 });
  if (!text || text.length > 10000) return NextResponse.json({ error: "내용을 입력하세요. (10000자 이하)" }, { status: 400 });

  const published = body.published === true;
  const pinned = body.pinned === true;
  const now = new Date().toISOString();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("board_posts")
    .insert({
      org_id: tenant.id,
      post_type,
      category: typeof body.category === "string" ? body.category : null,
      title,
      body: text,
      pinned,
      published,
      published_at: published ? now : null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
