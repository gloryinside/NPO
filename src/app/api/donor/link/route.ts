import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";

/**
 * 현재 로그인한 Supabase 유저의 이메일로 members 행을 찾아
 * supabase_uid 를 연결한다. Phase 1 셀프가입 플로우의 백엔드.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const tenant = await getTenant();
  if (!tenant) {
    return NextResponse.json(
      { error: "테넌트를 찾을 수 없습니다." },
      { status: 400 }
    );
  }

  const email = user.email;
  if (!email) {
    return NextResponse.json(
      { error: "이메일 정보가 없습니다." },
      { status: 400 }
    );
  }

  const admin = createSupabaseAdminClient();

  // 이미 연결된 member 가 있는지 확인 (idempotent)
  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("org_id", tenant.id)
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, member_id: existing.id });
  }

  // 같은 테넌트에서 이메일이 일치하는 member 검색 (uid 연결 여부 무관)
  const { data: member, error } = await admin
    .from("members")
    .select("id, supabase_uid")
    .eq("org_id", tenant.id)
    .eq("email", email)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "멤버 조회 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  if (!member) {
    return NextResponse.json(
      {
        error:
          "등록된 후원 내역이 없습니다. 기부 내역이 있는 이메일로 가입해주세요.",
      },
      { status: 404 }
    );
  }

  // 이미 다른 계정에 연결된 경우 — uid 덮어쓰기 방지
  if (member.supabase_uid && member.supabase_uid !== user.id) {
    return NextResponse.json(
      { error: "이미 다른 계정으로 연결된 이메일입니다. 해당 계정으로 로그인해주세요." },
      { status: 409 }
    );
  }

  // 이미 이 계정에 연결된 경우 — idempotent
  if (member.supabase_uid === user.id) {
    return NextResponse.json({ ok: true, member_id: member.id });
  }

  const { error: updateError } = await admin
    .from("members")
    .update({ supabase_uid: user.id })
    .eq("id", member.id);

  if (updateError) {
    return NextResponse.json(
      { error: "멤버 연결 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, member_id: member.id });
}
