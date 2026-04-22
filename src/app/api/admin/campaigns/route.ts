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
    thumbnail_url,
    donation_type,
    preset_amounts,
    pay_methods,
    ga_tracking_id,
    meta_pixel_id,
    seo_title,
    seo_description,
    og_image_url,
  } = body as {
    title?: string;
    slug?: string;
    description?: string;
    goal_amount?: number;
    status?: string;
    started_at?: string;
    ended_at?: string;
    thumbnail_url?: string | null;
    donation_type?: string;
    preset_amounts?: unknown;
    pay_methods?: string[];
    ga_tracking_id?: string | null;
    meta_pixel_id?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    og_image_url?: string | null;
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

  // preset_amounts: 숫자 배열만 허용
  let presetAmountsClean: number[] | null = null;
  if (Array.isArray(preset_amounts)) {
    presetAmountsClean = preset_amounts
      .map((v) => Number(v))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (presetAmountsClean.length === 0) presetAmountsClean = null;
  }

  // pay_methods: 허용된 문자열 배열만
  const ALLOWED_METHODS = ["card", "transfer", "cms", "manual"];
  const payMethodsClean =
    Array.isArray(pay_methods) && pay_methods.length > 0
      ? pay_methods.filter((m): m is string => typeof m === "string" && ALLOWED_METHODS.includes(m))
      : null;

  const ALLOWED_DONATION_TYPE = ["regular", "onetime", "both"];
  const donationTypeClean =
    donation_type && ALLOWED_DONATION_TYPE.includes(donation_type) ? donation_type : "both";

  const insertData: Record<string, unknown> = {
    org_id: tenant.id,
    title: title.trim(),
    slug: slug.trim(),
    description: description ? sanitizeHtml(description) : null,
    goal_amount: goal_amount ?? null,
    status: status ?? "draft",
    started_at: started_at ?? null,
    ended_at: ended_at ?? null,
    thumbnail_url: thumbnail_url?.trim() || null,
    donation_type: donationTypeClean,
    preset_amounts: presetAmountsClean,
    pay_methods: payMethodsClean ?? ["card"],
    ga_tracking_id: ga_tracking_id?.trim() || null,
    meta_pixel_id: meta_pixel_id?.trim() || null,
    seo_title: seo_title?.trim() || null,
    seo_description: seo_description?.trim() || null,
    og_image_url: og_image_url?.trim() || null,
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
