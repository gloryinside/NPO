import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { parseVariants } from "@/lib/ab/form-test";
import { loadAbStats } from "@/lib/ab/form-test-data";

/**
 * GET  /api/admin/ab-tests — 신청 화면 A/B 비교 목록과 결과
 * POST /api/admin/ab-tests — 시작 { campaignId, name, variants:[A, B] } (캠페인마다 진행 중 하나)
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("form_ab_tests")
    .select("id, name, status, variants, started_at, stopped_at, campaign_id, campaigns(title)")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const items = await Promise.all(
    (data ?? []).map(async (t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      variants: t.variants,
      startedAt: t.started_at,
      stoppedAt: t.stopped_at,
      campaignTitle: (t.campaigns as unknown as { title?: string } | null)?.title ?? null,
      stats: await loadAbStats(supabase, tenant.id, t.id),
    })),
  );
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const name = typeof parsed.body.name === "string" ? parsed.body.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "실험 이름을 적어 주세요." }, { status: 400 });
  const variants = parseVariants(parsed.body.variants);
  if (!variants.ok) return NextResponse.json({ error: variants.error }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const campaignId = typeof parsed.body.campaignId === "string" ? parsed.body.campaignId : "";
  const { data: campaign } = await supabase
    .from("campaigns").select("id, status").eq("id", campaignId).eq("org_id", tenant.id).maybeSingle();
  if (!campaign || campaign.status !== "active") return NextResponse.json({ error: "진행 중인 캠페인을 골라 주세요." }, { status: 400 });

  const { data, error } = await supabase
    .from("form_ab_tests")
    .insert({ org_id: tenant.id, campaign_id: campaign.id, name, variants: variants.value, created_by: user.id })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") return NextResponse.json({ error: "이 캠페인은 이미 비교 중입니다. 먼저 끝내 주세요." }, { status: 409 });
    return NextResponse.json({ error: "시작하지 못했습니다." }, { status: 500 });
  }
  await logAudit({
    orgId: tenant.id, actorId: user.id, actorEmail: user.email ?? null,
    action: "ab_test.start", resourceType: "form_ab_test", resourceId: data.id,
    summary: `신청 화면 A/B 비교 시작 (${name})`, metadata: { variants: variants.value },
  });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
