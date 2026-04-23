import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeMemberAudit } from "@/lib/donor/audit-log";
import { cookies } from "next/headers";

/**
 * G-D02: 후원자 본인 계정 삭제
 *
 * 삭제 모델: Soft-delete + PII 마스킹 (회계/감사/영수증 기록 보존 필요)
 * - members.status = 'withdrawn'
 * - email/phone/birth_date/name → 마스킹 값으로 치환
 * - active 약정은 전부 cancelled 로 전환
 * - Supabase Auth 사용자는 비활성화(선택: email ban)
 *
 * 확인 수단:
 * - Supabase 계정이면 currentPassword 검증
 * - OTP 계정이면 confirmText === '삭제' 요구
 *
 * Hard-delete는 추후 관리자 요청 플로우로 분리.
 */
export async function DELETE(req: NextRequest) {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }

  let body: { currentPassword?: unknown; confirmText?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 확인 단계
  if (session.authMethod === "supabase" && session.user?.email) {
    const pwd =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    if (!pwd) {
      return NextResponse.json(
        { error: "현재 비밀번호를 입력하세요." },
        { status: 400 }
      );
    }
    const server = await createSupabaseServerClient();
    const { error: signInErr } = await server.auth.signInWithPassword({
      email: session.user.email,
      password: pwd,
    });
    if (signInErr) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 400 }
      );
    }
  } else {
    const confirmText =
      typeof body.confirmText === "string" ? body.confirmText.trim() : "";
    if (confirmText !== "삭제") {
      return NextResponse.json(
        { error: "확인을 위해 '삭제' 를 입력해주세요." },
        { status: 400 }
      );
    }
  }

  const admin = createSupabaseAdminClient();
  const suffix = session.member.id.slice(0, 8);
  const now = new Date().toISOString();

  // 1) members 마스킹 + withdrawn
  const { error: memberErr } = await admin
    .from("members")
    .update({
      status: "withdrawn",
      name: `탈퇴회원_${suffix}`,
      email: `withdrawn+${suffix}@deleted.local`,
      phone: null,
      birth_date: null,
      supabase_uid: null,
      deleted_at: now,
      updated_at: now,
    })
    .eq("id", session.member.id)
    .eq("org_id", session.member.org_id);

  if (memberErr) {
    return NextResponse.json(
      { error: "계정 삭제에 실패했습니다.", detail: memberErr.message },
      { status: 500 }
    );
  }

  // 2) 활성 약정 전체 해지
  await admin
    .from("promises")
    .update({ status: "cancelled", ended_at: now, updated_at: now })
    .eq("member_id", session.member.id)
    .in("status", ["active", "suspended", "pending_billing"]);

  // 3) Supabase Auth 사용자 삭제(있는 경우)
  if (session.user?.id) {
    try {
      await admin.auth.admin.deleteUser(session.user.id);
    } catch {
      // best-effort: Auth 삭제 실패해도 member 측은 이미 마스킹됨
    }
  }

  // 4) 감사 로그
  await writeMemberAudit(admin, {
    orgId: session.member.org_id,
    memberId: session.member.id,
    action: "account_delete",
    diff: { method: session.authMethod },
  });

  // 5) 세션 쿠키 정리
  const cookieStore = await cookies();
  cookieStore.delete("donor-otp-session");
  // Supabase 세션 쿠키는 signOut 로 정리
  if (session.authMethod === "supabase") {
    const server = await createSupabaseServerClient();
    await server.auth.signOut().catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
