import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * PATCH /api/donor/profile
 *
 * 후원자 본인이 자신의 기본 정보(이름/연락처/생년월일)를 수정.
 * email 은 로그인 계정과 연결되어 있으므로 이 엔드포인트에서는 수정 불가.
 * status / member_type 등 관리 속성도 변경 불가.
 */
export async function PATCH(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, phone, birthDate } = body as {
    name?: string;
    phone?: string | null;
    birthDate?: string | null;
  };

  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "이름은 필수입니다." }, { status: 400 });
    }
    update.name = name.trim();
  }
  if (phone !== undefined) {
    update.phone = typeof phone === "string" ? phone.trim() || null : null;
  }
  if (birthDate !== undefined) {
    update.birth_date = birthDate && typeof birthDate === "string" ? birthDate : null;
  }

  if (Object.keys(update).length <= 1) {
    return NextResponse.json({ error: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from("members")
    .update(update)
    .eq("id", session.member.id)
    .eq("org_id", session.member.org_id)
    .select("id, name, phone, email, birth_date, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ member: data });
}
