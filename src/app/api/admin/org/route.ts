import { checkBizNo, DONATION_TYPE_CODES } from "@/lib/receipt/validation";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { readJsonObject } from "@/lib/http/body";
import { requireAdminApi } from "@/lib/auth/api-guard";

/**
 * GET /api/admin/org
 * 현재 테넌트의 기관 프로필을 반환한다.
 *
 * PATCH /api/admin/org
 * 기관 프로필(이름, 사업자번호, 연락처, 소개 등)을 수정한다.
 * slug / status / plan / custom_domain 은 변경 불가(운영팀 전용).
 */

const EDITABLE_FIELDS = [
  "name",
  "business_no",
  "logo_url",
  "hero_image_url",
  "tagline",
  "about",
  "contact_email",
  "contact_phone",
  "address",
  "show_stats",
  "bank_name",
  "bank_account",
  "account_holder",
  // 기부금영수증 법정 기재사항
  "representative_name",
  "donee_type",
  "donee_legal_basis",
  "donee_code",
  "donation_type_code",
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .select(
      "id, slug, name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats, representative_name, donee_type, donee_legal_basis, donee_code, donation_type_code"
    )
    .eq("id", tenant.id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "기관 정보를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ org: data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const parsed = await readJsonObject(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  // 허용된 필드만 추출
  const update: Partial<Record<EditableField, unknown>> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      update[field] = body[field];
    }
  }

  if (Object.keys(update).length === 0)
    return NextResponse.json(
      { error: "변경할 필드가 없습니다." },
      { status: 400 }
    );

  // name이 있으면 빈 문자열 금지
  if ("name" in update && (typeof update.name !== "string" || !update.name.trim()))
    return NextResponse.json({ error: "기관명은 필수입니다." }, { status: 400 });

  // business_no 형식 검증: "-" 제거 후 10자리 숫자
  if ("business_no" in update && update.business_no !== null && update.business_no !== "") {
    const raw =
      typeof update.business_no === "string"
        ? update.business_no.replace(/-/g, "").trim()
        : "";
    if (!/^\d{10}$/.test(raw) || !checkBizNo(raw)) {
      return NextResponse.json(
        { error: "사업자등록번호(고유번호) 10자리를 확인해 주세요. 검증번호가 맞지 않습니다." },
        { status: 400 }
      );
    }
    update.business_no = raw;
  }

  // 국세청 기부금단체코드 — 알파벳 대문자 3자리
  if ("donee_code" in update && update.donee_code) {
    const code = String(update.donee_code).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return NextResponse.json({ error: "기부금단체코드는 알파벳 3자리입니다(예: 국세청 기부금단체코드표)." }, { status: 400 });
    }
    update.donee_code = code;
  }

  // 기부금 유형 코드 — 별지 제45호서식 코드만
  if ("donation_type_code" in update) {
    const t = update.donation_type_code ? String(update.donation_type_code).trim() : null;
    if (t && !(t in DONATION_TYPE_CODES)) {
      return NextResponse.json({ error: "기부금 유형 코드가 올바르지 않습니다(10·20·40·41·42·43)." }, { status: 400 });
    }
    update.donation_type_code = t;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", tenant.id)
    .select(
      "id, slug, name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats, representative_name, donee_type, donee_legal_basis, donee_code, donation_type_code"
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ org: data });
}
