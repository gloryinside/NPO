import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";
import { kstToday } from "@/lib/billing/kst";
import { checkForm, parseForm, parseYear } from "@/lib/disclosure/nts-63-7";
import { buildDraftFromRecords, loadSavedForm, saveForm } from "@/lib/disclosure/nts-63-7-data";

/**
 * GET /api/admin/disclosures/nts-63-7?year=2025[&fresh=1]
 *   저장한 작성본(없거나 fresh=1 이면 시스템 기록으로 만든 초안)과 고칠 점
 * PUT /api/admin/disclosures/nts-63-7  { year, form } — 회계 담당자만
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const year = parseYear(req.nextUrl.searchParams.get("year"));
  if (!year) return NextResponse.json({ error: "연도를 확인해 주세요." }, { status: 400 });

  const supabase = createSupabaseAdminClient();
  const saved = req.nextUrl.searchParams.get("fresh") === "1" ? null : await loadSavedForm(supabase, tenant.id, year);
  try {
    const form = saved?.form ?? (await buildDraftFromRecords(supabase, tenant.id, year, kstToday()));
    return NextResponse.json({ form, saved: !!saved, updatedAt: saved?.updatedAt ?? null, warnings: checkForm(form) });
  } catch (e) {
    console.error("[nts-63-7] draft failed:", (e as Error).message);
    return NextResponse.json({ error: "기록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["finance"]))) {
    return NextResponse.json({ error: "회계 담당자 권한이 필요합니다." }, { status: 403 });
  }
  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const year = parseYear(String(parsed.body.year ?? ""));
  if (!year) return NextResponse.json({ error: "연도를 확인해 주세요." }, { status: 400 });
  const form = parseForm(parsed.body.form);
  if (!form.ok) return NextResponse.json({ error: form.error }, { status: 400 });

  const err = await saveForm(createSupabaseAdminClient(), tenant.id, year, form.value, user.id);
  if (err) return NextResponse.json({ error: "저장하지 못했습니다." }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "disclosure.nts_save",
    resourceType: "transparency_disclosure",
    resourceId: String(year),
    summary: `${year}년 연간 기부금 모금액 및 활용실적 명세서 저장`,
  });
  return NextResponse.json({ ok: true, form: form.value, warnings: checkForm(form.value) });
}
