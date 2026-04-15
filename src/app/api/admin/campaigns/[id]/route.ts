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
  } = body as {
    title?: string;
    slug?: string;
    description?: string;
    goal_amount?: number | null;
    status?: string;
    started_at?: string | null;
    ended_at?: string | null;
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
