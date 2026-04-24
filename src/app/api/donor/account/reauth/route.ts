import { NextRequest, NextResponse } from "next/server";
import { getDonorSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { issueReauthToken } from "@/lib/auth/reauth";
import { checkCsrf } from "@/lib/security/csrf";
import { enforceDonorLimit, limitResponse } from "@/lib/security/endpoint-limits";

/**
 * SP-5: 재인증 토큰 발급.
 *
 * POST /api/donor/account/reauth
 *   body: { password: string }
 *   응답: { token: string }
 *
 * - Supabase Auth 사용자: 비밀번호 재확인 후 30분 유효 토큰 발급
 * - OTP 사용자: 이 엔드포인트 미지원 (OTP 재발송 플로우 별도)
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = enforceDonorLimit(session.member.id, "account:reauth", "sensitive");
  if (!rl.allowed) return limitResponse(rl);

  if (session.authMethod !== "supabase" || !session.user?.email) {
    return NextResponse.json(
      {
        error:
          "OTP 로그인 사용자는 이 경로를 사용할 수 없습니다. OTP 재발송으로 인증해 주세요.",
        code: "OTP_REAUTH_UNSUPPORTED",
      },
      { status: 400 },
    );
  }

  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!password) {
    return NextResponse.json(
      { error: "비밀번호를 입력해 주세요." },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: session.user.email,
    password,
  });

  if (error) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 },
    );
  }

  const token = issueReauthToken(session.member.id);
  return NextResponse.json({ token });
}
