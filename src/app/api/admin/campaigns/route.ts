import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";

const SLUG_REGEX = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  // requireAdminUser redirects to /admin/login if not authenticated
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 100, 1), 200);

  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .range(0, limit - 1);

  if (q) {
    const escaped = q.replace(/[%,()]/g, "");
    query = query.ilike("title", `%${escaped}%`);
  }

  const { data: campaigns, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaigns });
}

export async function POST(req: NextRequest) {
  await requireAdminUser();

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    title,
    slug,
    description,
    goal_amount,
    status,
    started_at,
    ended_at,
  } = body as {
    title?: string;
    slug?: string;
    description?: string;
    goal_amount?: number;
    status?: string;
    started_at?: string;
    ended_at?: string;
  };

  if (!title || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "title은 필수입니다." }, { status: 400 });
  }
  if (!slug || typeof slug !== "string" || slug.trim() === "") {
    return NextResponse.json({ error: "slug는 필수입니다." }, { status: 400 });
  }
  if (!SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { error: "slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다." },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();

  const insertData: Record<string, unknown> = {
    org_id: tenant.id,
    title: title.trim(),
    slug: slug.trim(),
    description: description ? sanitizeHtml(description) : null,
    goal_amount: goal_amount ?? null,
    status: status ?? "draft",
    started_at: started_at ?? null,
    ended_at: ended_at ?? null,
  };

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "이미 사용중인 슬러그입니다." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign }, { status: 201 });
}
