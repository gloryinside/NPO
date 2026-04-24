import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeMemberAudit } from "@/lib/donor/audit-log";
import { sendEmail } from "@/lib/email/send-email";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";
import { cookies } from "next/headers";
import { revokeOtpSession, OTP_SESSION_COOKIE_NAME } from "@/lib/auth/otp-session";
import { decodeJwt } from "jose";

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
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
  }
  const rl = enforceDonorLimit(session.member.id, "account:delete", "sensitive");
  if (!rl.allowed) return limitResponse(rl);

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

  // 0) 삭제 전 확인 이메일 (G-D27) — best-effort
  //    members 마스킹 이후에는 원 이메일을 알 수 없으므로 먼저 발송
  const originalEmail = session.member.email || session.user?.email || null;
  const originalName = session.member.name;
  const orgName = await (async () => {
    const { data } = await admin
      .from("orgs")
      .select("name")
      .eq("id", session.member.org_id)
      .maybeSingle();
    return data?.name ?? "후원 기관";
  })();
  if (originalEmail) {
    const whenKST = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Seoul",
    });
    await sendEmail({
      to: originalEmail,
      subject: `[${orgName}] 계정 삭제 처리 안내`,
      html: `
        <div style="font-family: -apple-system, 'Noto Sans KR', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #1f2937;">
          <h1 style="font-size: 20px; margin: 0 0 16px;">계정 삭제가 처리되었습니다</h1>
          <p>${originalName}님 안녕하세요,</p>
          <p>${whenKST} 기준으로 <b>${orgName}</b> 후원자 계정 삭제 요청이 처리되었습니다.</p>
          <div style="background:#f9fafb; border-left:3px solid #ef4444; padding:12px 16px; margin:16px 0;">
            <p style="margin:0; font-size:14px;">
              · 개인정보(이름·연락처·생년월일)는 마스킹 처리되었습니다.<br/>
              · 진행 중이던 모든 약정(정기/일시)이 자동 해지되었습니다.<br/>
              · 과거 후원 이력과 영수증은 회계·세무 목적으로 보존됩니다.
            </p>
          </div>
          <p style="font-size:13px; color:#6b7280;">
            본인이 진행하지 않은 요청이라면 즉시 support 로 문의해주세요.
          </p>
          <p style="font-size:13px; color:#6b7280; margin-top:24px;">
            그동안의 후원에 진심으로 감사드립니다.
          </p>
        </div>
      `,
    }).catch(() => {});
  }

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

  // 5) 세션 쿠키 정리 + SP-5 OTP blocklist 등록
  const cookieStore = await cookies();
  if (session.authMethod === "otp") {
    const otpToken = cookieStore.get(OTP_SESSION_COOKIE_NAME)?.value;
    if (otpToken) {
      try {
        const { iat } = decodeJwt(otpToken);
        if (typeof iat === "number") {
          await revokeOtpSession(iat, session.member.id, "account_delete");
        }
      } catch {
        // best-effort — 토큰 파싱 실패해도 쿠키 삭제는 진행
      }
    }
  }
  cookieStore.delete(OTP_SESSION_COOKIE_NAME);
  // Supabase 세션 쿠키는 signOut 로 정리
  if (session.authMethod === "supabase") {
    const server = await createSupabaseServerClient();
    await server.auth.signOut().catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
