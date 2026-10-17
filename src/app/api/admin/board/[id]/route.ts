import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";

type RouteParams = Promise<{ id: string }>;

// PATCH /api/admin/board/[id]
export async function PATCH(req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject<{ title?: unknown; body?: unknown; pinned?: unknown; published?: unknown; category?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

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
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("board_posts")
    .delete()
    .eq("id", id)
    .eq("org_id", tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
