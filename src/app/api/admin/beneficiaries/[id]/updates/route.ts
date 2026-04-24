import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/admin/beneficiaries/[id]/updates  — 수혜자 정기 근황
 * POST /api/admin/beneficiaries/[id]/updates  — 새 근황 등록
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: beneficiaryId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("beneficiary_updates")
    .select("id, update_date, title, body, photo_urls, visibility, created_at")
    .eq("org_id", tenant.id)
    .eq("beneficiary_id", beneficiaryId)
    .order("update_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id: beneficiaryId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const updateBody = typeof body.body === "string" ? body.body.trim() : "";
  const photoUrls = Array.isArray(body.photoUrls) ? body.photoUrls : [];
  if (!updateBody && photoUrls.length === 0) {
    return NextResponse.json(
      { error: "body 또는 photoUrls 필수" },
      { status: 400 }
    );
  }

  const visibility = body.visibility === "public" ? "public" : "sponsors_only";

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("beneficiary_updates")
    .insert({
      org_id: tenant.id,
      beneficiary_id: beneficiaryId,
      update_date: typeof body.updateDate === "string"
        ? body.updateDate
        : new Date().toISOString().slice(0, 10),
      title: typeof body.title === "string" ? body.title : null,
      body: updateBody || null,
      photo_urls: photoUrls,
      visibility,
      created_by: user.id,
    })
    .select("id")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id });
}
