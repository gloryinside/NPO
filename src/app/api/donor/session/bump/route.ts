import { NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import {
  signOtpToken,
  otpSessionCookieConfig,
} from "@/lib/auth/otp-session";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D30: 세션 비활성 타임아웃 연장용 엔드포인트 (슬라이딩 세션).
 *
 * 클라이언트가 사용자 활동을 감지하면 주기적으로 호출하여 lastSeen 을 갱신.
 * - Supabase 세션은 Supabase 클라이언트가 자체 refresh 함 → 여기선 OTP JWT만 대상
 * - 인증 없음 / 이미 만료 → 401 (클라이언트가 로그인 페이지로 유도)
 */
export async function POST(req: Request) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  if (session.authMethod !== "otp") {
    return NextResponse.json({ ok: true, refreshed: false });
  }

  const token = await signOtpToken({
    memberId: session.member.id,
    orgId: session.member.org_id,
    phone: "renew", // phone은 payload 보존용이지만 renew 시점엔 식별자 역할만
    lastSeen: Date.now(),
  });

  const res = NextResponse.json({ ok: true, refreshed: true });
  res.cookies.set(otpSessionCookieConfig(token));
  return res;
}
