import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeMemberAudit } from "@/lib/donor/audit-log";
import { checkCsrf } from "@/lib/security/csrf";
import { checkPasswordStrength } from "@/lib/security/password-policy";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";

/**
 * G-D01: 후원자 본인 비밀번호 변경
 *
 * 요구사항:
 * - Supabase 이메일/비밀번호 가입 계정만 사용 가능 (OTP 전용 계정은 405)
 * - 현재 비밀번호 확인 → 새 비밀번호 적용
 * - 최소 8자, 공백 제거 후 검증
 * - 감사 로그 기록 (비밀번호 원문은 저장 X)
 */
export async function PATCH(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rl = enforceDonorLimit(session.member.id, "password:change", "sensitive");
  if (!rl.allowed) return limitResponse(rl);

  if (session.authMethod !== "supabase" || !session.user?.email) {
    return NextResponse.json(
      { error: "이메일/비밀번호 계정에서만 변경할 수 있습니다." },
      { status: 405 }
    );
  }

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const currentPassword =
    typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword =
    typeof body.newPassword === "string" ? body.newPassword : "";

  const strength = checkPasswordStrength(newPassword);
  if (!strength.ok) {
    return NextResponse.json({ error: strength.error }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "현재 비밀번호와 동일합니다." },
      { status: 400 }
    );
  }

  // 현재 비밀번호 확인: 재로그인 시도로 검증 (익명 세션)
  const email = session.user.email;
  const server = await createSupabaseServerClient();
  const { error: signInErr } = await server.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (signInErr) {
    return NextResponse.json(
      { error: "현재 비밀번호가 올바르지 않습니다." },
      { status: 400 }
    );
  }

  // 비밀번호 업데이트 (admin API)
  const admin = createSupabaseAdminClient();
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    session.user.id,
    { password: newPassword }
  );
  if (updateErr) {
    return NextResponse.json(
      { error: "비밀번호 변경에 실패했습니다." },
      { status: 500 }
    );
  }

  await writeMemberAudit(admin, {
    orgId: session.member.org_id,
    memberId: session.member.id,
    action: "password_change",
    diff: null,
  });

  return NextResponse.json({ ok: true });
}
