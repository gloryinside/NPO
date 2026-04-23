import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D154/D155: 캠페인 버전 저장 / 목록.
 *
 * POST /api/admin/campaigns/[id]/versions
 *   body: { label: 'manual'|'autosave'|'publish' }
 *   캠페인의 현재 page_content/form_settings/title 을 snapshot 으로 저장.
 *
 * GET : 최근 50건 목록 (restore UI 용)
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("campaign_versions")
    .select("id, label, title, created_by_email, created_at")
    .eq("org_id", tenant.id)
    .eq("campaign_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  return NextResponse.json({ versions: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: { label?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const rawLabel = typeof body.label === "string" ? body.label : "manual";
  const label =
    rawLabel === "autosave" || rawLabel === "publish" ? rawLabel : "manual";

  const supabase = createSupabaseAdminClient();
  const { data: c } = await supabase
    .from("campaigns")
    .select("title, page_content, form_settings")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!c) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { error } = await supabase.from("campaign_versions").insert({
    org_id: tenant.id,
    campaign_id: id,
    title: c.title,
    page_content: c.page_content,
    form_settings: c.form_settings,
    created_by: user.id,
    created_by_email: user.email ?? null,
    label,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // autosave 정리 — 같은 캠페인의 autosave 는 최근 10개만
  if (label === "autosave") {
    const { data: olds } = await supabase
      .from("campaign_versions")
      .select("id")
      .eq("campaign_id", id)
      .eq("label", "autosave")
      .order("created_at", { ascending: false })
      .range(10, 999);
    const ids = (olds ?? []).map((r) => r.id);
    if (ids.length > 0) {
      await supabase.from("campaign_versions").delete().in("id", ids);
    }
  }

  return NextResponse.json({ ok: true });
}
