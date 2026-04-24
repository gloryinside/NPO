import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

const ALLOWED = ["open", "answered", "closed"] as const;

// PATCH /api/admin/inquiries/[id]/status — 상태 변경 (재오픈 / 닫기)
export async function PATCH(req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: { status?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const status = ALLOWED.includes(body.status as typeof ALLOWED[number])
    ? (body.status as string)
    : null;
  if (!status) return NextResponse.json({ error: "유효하지 않은 상태입니다." }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const patch: Record<string, string | null> = { status, updated_at: now };
  if (status === "closed") patch.closed_at = now;

  const { error } = await admin
    .from("inquiries")
    .update(patch)
    .eq("id", id)
    .eq("org_id", tenant.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
