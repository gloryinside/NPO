import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type RouteParams = Promise<{ id: string }>;

// GET /api/admin/inquiries/[id]
export async function GET(_req: NextRequest, { params }: { params: RouteParams }) {
  const { id } = await params;
  await requireAdminUser();
  const tenant = await requireTenant();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("inquiries")
    .select("id, category, subject, body, status, created_at, answered_at, closed_at, members(id, name, email), inquiry_replies(id, author_role, body, created_at)")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "찾을 수 없습니다." }, { status: 404 });
  return NextResponse.json({ inquiry: data });
}
