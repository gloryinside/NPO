import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { logAudit } from "@/lib/audit";

/**
 * PATCH /api/admin/beneficiaries/[id] — 후원 신청 화면 공개 여부
 *   { publicListing: boolean, guardianName?, guardianRelation?, consentDate? }
 * 아이의 사진·소개가 공개 화면에 나가므로 켤 때는 보호자 동의 기록(누가·관계·날짜)이 있어야 한다
 * (개인정보 보호법 제22조의2 — 만 14세 미만 아동은 법정대리인 동의). 바꿀 때마다 감사 로그.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  if (typeof parsed.body.publicListing !== "boolean") {
    return NextResponse.json({ error: "publicListing(true/false)이 필요합니다." }, { status: 400 });
  }
  const publicListing = parsed.body.publicListing;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const guardianName = str(parsed.body.guardianName, 40);
  const guardianRelation = str(parsed.body.guardianRelation, 20);
  const consentDate = str(parsed.body.consentDate, 10);
  if (publicListing) {
    if (!guardianName || !guardianRelation || !/^\d{4}-\d{2}-\d{2}$/.test(consentDate)) {
      return NextResponse.json({ error: "공개하려면 보호자 이름·관계·동의 날짜를 적어 주세요." }, { status: 400 });
    }
    if (consentDate > new Date().toISOString().slice(0, 10)) {
      return NextResponse.json({ error: "동의 날짜는 오늘 이전이어야 합니다." }, { status: 400 });
    }
  }

  const { data, error } = await createSupabaseAdminClient()
    .from("beneficiaries")
    .update({
      public_listing: publicListing,
      updated_at: new Date().toISOString(),
      ...(publicListing
        ? {
            listing_consent_by: guardianName,
            listing_consent_relation: guardianRelation,
            listing_consent_date: consentDate,
            listing_consent_recorded_by: user.id,
          }
        : {}),
    })
    .eq("id", id)
    .eq("org_id", tenant.id)
    .select("id, code")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "수혜자를 찾을 수 없습니다." }, { status: 404 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "beneficiary.public_listing",
    resourceType: "beneficiary",
    resourceId: id,
    summary: `${data.code} 신청 화면 ${publicListing ? `공개 (보호자 ${guardianRelation} 동의 ${consentDate})` : "비공개"}`,
  });
  return NextResponse.json({ ok: true });
}
