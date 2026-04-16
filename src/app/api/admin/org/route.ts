import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

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
] as const;

type EditableField = (typeof EDITABLE_FIELDS)[number];

export async function GET() {
  await requireAdminUser();
  const tenant = await requireTenant();

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .select(
      "id, slug, name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats"
    )
    .eq("id", tenant.id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "기관 정보를 찾을 수 없습니다." }, { status: 404 });

  return NextResponse.json({ org: data });
}

export async function PATCH(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

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
    if (!/^\d{10}$/.test(raw)) {
      return NextResponse.json(
        { error: "사업자등록번호는 10자리 숫자여야 합니다." },
        { status: 400 }
      );
    }
    update.business_no = raw;
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("orgs")
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq("id", tenant.id)
    .select(
      "id, slug, name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats"
    )
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ org: data });
}
