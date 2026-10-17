import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireAdminApi } from "@/lib/auth/api-guard";

// GET /api/admin/inquiries?status=open&page=0
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "open";
  const page = Math.max(0, Number(searchParams.get("page") ?? 0));
  const PAGE_SIZE = 30;

  const admin = createSupabaseAdminClient();
  let q = admin
    .from("inquiries")
    .select("id, category, subject, status, created_at, answered_at, members(id, name, email)", { count: "exact" })
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

  if (status !== "all") q = q.eq("status", status);

  const { data, count, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ inquiries: data, total: count });
}
