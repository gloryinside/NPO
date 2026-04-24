import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

// PATCH /api/admin/board/[id]
export async function PATCH(req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: { title?: unknown; body?: unknown; pinned?: unknown; published?: unknown; category?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.title === "string") patch.title = body.title.trim();
  if (typeof body.body === "string") patch.body = body.body.trim();
  if (typeof body.pinned === "boolean") patch.pinned = body.pinned;
  if (typeof body.category === "string") patch.category = body.category;
  if (typeof body.published === "boolean") {
    patch.published = body.published;
    patch.published_at = body.published ? new Date().toISOString() : null;
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("board_posts")
    .update(patch)
    .eq("id", id)
    .eq("org_id", tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/board/[id]
export async function DELETE(_req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  await requireAdminUser();
  const tenant = await requireTenant();

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("board_posts")
    .delete()
    .eq("id", id)
    .eq("org_id", tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
