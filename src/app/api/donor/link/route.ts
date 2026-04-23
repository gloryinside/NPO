import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTenant } from "@/lib/tenant/context";
import { findReferrerByCode } from "@/lib/donor/referral";
import { isDonorAuthBypassEnabled } from "@/lib/auth/donor-bypass";
import { generateMemberCode } from "@/lib/codes";

/**
 * 현재 로그인한 Supabase 유저의 이메일로 members 행을 찾아
 * supabase_uid 를 연결한다. Phase 1 셀프가입 플로우의 백엔드.
 *
 * Phase 5-B: body의 referralCode가 있으면 추천인 관계도 함께 설정.
 * 이미 referrer_id가 있으면 덮어쓰지 않는다 (기존 관계 보호).
 */
export async function POST(req: NextRequest) {
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

  // Phase 5-B: 선택적 referralCode (signup URL의 ?ref= → body로 전달)
  // body가 없거나 잘못된 JSON이어도 링크 자체는 계속 진행 (추천 관계는 best-effort)
  let referralCode: string | null = null;
  try {
    const body = (await req.json().catch(() => null)) as
      | { referralCode?: unknown }
      | null;
    const raw = body?.referralCode;
    if (typeof raw === "string" && raw.trim().length > 0) {
      referralCode = raw.trim();
    }
  } catch {
    // body parse 실패는 무시
  }

  const admin = createSupabaseAdminClient();

  // referralCode → referrer member_id 적용. 실패해도 링크 플로우는 유지.
  // referrer_id IS NULL 조건으로 업데이트해 기존 관계는 절대 덮어쓰지 않는다.
  async function tryApplyReferrer(memberId: string) {
    if (!referralCode) return;
    try {
      const referrer = await findReferrerByCode(admin, referralCode);
      if (!referrer) return;
      if (referrer.orgId !== tenant!.id) return; // cross-tenant 차단
      if (referrer.memberId === memberId) return; // self-referral 차단
      await admin
        .from("members")
        .update({ referrer_id: referrer.memberId })
        .eq("id", memberId)
        .is("referrer_id", null);
    } catch {
      // 추천 관계 설정 실패는 조용히 무시 (주 흐름 보호)
    }
  }

  // 이미 연결된 member 가 있는지 확인 (idempotent)
  const { data: existing } = await admin
    .from("members")
    .select("id")
    .eq("org_id", tenant.id)
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (existing) {
    await tryApplyReferrer(existing.id);
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
    // 개발용 우회 모드: member 없어도 자동 생성 후 연결
    if (isDonorAuthBypassEnabled()) {
      const { data: lastMember } = await admin
        .from("members")
        .select("member_code")
        .eq("org_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const year = new Date().getFullYear();
      let nextSeq = 1;
      const lastCode = lastMember?.member_code as string | undefined;
      const parsed = lastCode?.match(/^M-(\d{4})(\d{5})$/);
      if (parsed && Number(parsed[1]) === year) nextSeq = Number(parsed[2]) + 1;
      const memberCode = generateMemberCode(year, nextSeq);

      const { data: created, error: createErr } = await admin
        .from("members")
        .insert({
          org_id: tenant.id,
          member_code: memberCode,
          name: "테스트 후원자",
          status: "active",
          email,
          supabase_uid: user.id,
          join_path: "dev_bypass",
        })
        .select("id")
        .maybeSingle();

      if (createErr || !created) {
        return NextResponse.json({ error: "멤버 생성 실패" }, { status: 500 });
      }
      await tryApplyReferrer(created.id);
      return NextResponse.json({ ok: true, member_id: created.id });
    }

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
    await tryApplyReferrer(member.id);
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

  await tryApplyReferrer(member.id);
  return NextResponse.json({ ok: true, member_id: member.id });
}
