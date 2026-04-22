import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sanitizeHtml } from "@/lib/sanitize";

const SLUG_REGEX = /^[a-z0-9-]+$/;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  const { id } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .single();

  if (error || !campaign) {
    return NextResponse.json(
      { error: "캠페인을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json({ campaign });
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  const { id } = await params;

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

  const supabase = createSupabaseAdminClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "캠페인을 찾을 수 없습니다." },
      { status: 404 }
    );
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
    goal_amount?: number | null;
    status?: string;
    started_at?: string | null;
    ended_at?: string | null;
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

  if (slug !== undefined && !SLUG_REGEX.test(slug)) {
    return NextResponse.json(
      { error: "slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다." },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (title !== undefined) updateData.title = title.trim();
  if (slug !== undefined) updateData.slug = slug.trim();
  if (description !== undefined)
    updateData.description = description ? sanitizeHtml(description) : null;
  if (goal_amount !== undefined) updateData.goal_amount = goal_amount;
  if (status !== undefined) updateData.status = status;
  if (started_at !== undefined) updateData.started_at = started_at;
  if (ended_at !== undefined) updateData.ended_at = ended_at;
  if (thumbnail_url !== undefined)
    updateData.thumbnail_url = thumbnail_url?.trim() || null;
  if (donation_type !== undefined) {
    const ALLOWED_DONATION_TYPE = ["regular", "onetime", "both"];
    if (!ALLOWED_DONATION_TYPE.includes(donation_type)) {
      return NextResponse.json(
        { error: "donation_type은 regular | onetime | both 중 하나여야 합니다." },
        { status: 400 }
      );
    }
    updateData.donation_type = donation_type;
  }
  if (preset_amounts !== undefined) {
    if (preset_amounts === null) {
      updateData.preset_amounts = null;
    } else if (Array.isArray(preset_amounts)) {
      const clean = preset_amounts
        .map((v) => Number(v))
        .filter((n) => Number.isFinite(n) && n > 0);
      updateData.preset_amounts = clean.length > 0 ? clean : null;
    }
  }
  if (pay_methods !== undefined) {
    const ALLOWED_METHODS = ["card", "transfer", "cms", "manual"];
    if (Array.isArray(pay_methods)) {
      const filtered = pay_methods.filter(
        (m): m is string => typeof m === "string" && ALLOWED_METHODS.includes(m)
      );
      updateData.pay_methods = filtered.length > 0 ? filtered : ["card"];
    }
  }
  if (ga_tracking_id !== undefined)
    updateData.ga_tracking_id = ga_tracking_id?.trim() || null;
  if (meta_pixel_id !== undefined)
    updateData.meta_pixel_id = meta_pixel_id?.trim() || null;
  if (seo_title !== undefined)
    updateData.seo_title = seo_title?.trim() || null;
  if (seo_description !== undefined)
    updateData.seo_description = seo_description?.trim() || null;
  if (og_image_url !== undefined)
    updateData.og_image_url = og_image_url?.trim() || null;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .update(updateData)
    .eq("id", id)
    .eq("org_id", tenant.id)
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

  return NextResponse.json({ campaign });
}

export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  await requireAdminUser();

  const { id } = await params;

  let tenant;
  try {
    tenant = await requireTenant();
  } catch {
    return NextResponse.json({ error: "Tenant not found" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // Verify ownership
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .single();

  if (!existing) {
    return NextResponse.json(
      { error: "캠페인을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ campaign });
}
