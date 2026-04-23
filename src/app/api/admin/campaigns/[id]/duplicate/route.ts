import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D137: 캠페인 복제.
 *
 * POST /api/admin/campaigns/[id]/duplicate
 *   body: { title?: string }
 *
 * 복제 대상 필드:
 *   - title, description, thumbnail_url, og_image_url
 *   - seo_title, seo_description
 *   - goal_amount, form_settings, page_content
 *   - status = 'draft' 강제, published_at/started_at/ended_at NULL
 *   - slug = 원본 slug + '-copy-{random}'
 *
 * 복제하지 않음:
 *   - payments / cheer / 통계
 *   - assets (원본 URL 공유)
 */
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

  const supabase = createSupabaseAdminClient();

  const { data: src } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!src) {
    return NextResponse.json(
      { error: "원본 캠페인을 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  let body: { title?: unknown };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const newTitle =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : `${(src.title as string) ?? "캠페인"} (복제)`;

  const suffix = Math.random().toString(36).slice(2, 8);
  const newSlug = `${src.slug ?? "campaign"}-copy-${suffix}`;

  // 복제 — id/타임스탬프/집계 필드 제거
  const copy: Record<string, unknown> = { ...src };
  delete copy.id;
  delete copy.created_at;
  delete copy.updated_at;
  delete copy.published_at;
  delete copy.started_at;
  delete copy.ended_at;
  delete copy.raised_amount; // 있다면
  delete copy.paid_count;
  copy.status = "draft";
  copy.slug = newSlug;
  copy.title = newTitle;
  copy.org_id = tenant.id;
  copy.scheduled_publish_at = null;

  const { data: inserted, error: insertErr } = await supabase
    .from("campaigns")
    .insert(copy)
    .select("id, slug, title")
    .maybeSingle();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "복제 실패", detail: insertErr?.message ?? null },
      { status: 500 }
    );
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "campaign.create",
    resourceType: "campaign",
    resourceId: inserted.id as string,
    summary: `캠페인 복제: ${src.title} → ${inserted.title}`,
    metadata: { sourceId: id, newSlug },
  }).catch(() => {});

  return NextResponse.json({ ok: true, campaign: inserted });
}
