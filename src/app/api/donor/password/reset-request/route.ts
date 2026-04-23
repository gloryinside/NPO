import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D26: 비밀번호 재설정 이메일 발송 요청 (미인증)
 *
 * - 이메일 존재 여부를 응답에 노출하지 않음 (user enumeration 방지) → 항상 ok:true
 * - Rate limit: 이메일당 15분에 3회 + IP당 15분에 10회
 * - Supabase auth.resetPasswordForEmail 호출 → 메일 템플릿은 대시보드 설정
 */
const REDIRECT_PATH = "/donor/password/reset";

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "유효한 이메일을 입력하세요." },
      { status: 400 }
    );
  }

  // IP rate limit
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipRl = rateLimit(`pwreset:ip:${ip}`, 10, 15 * 60_000);
  if (!ipRl.allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." },
      { status: 429 }
    );
  }
  // email rate limit
  const emailRl = rateLimit(`pwreset:email:${email}`, 3, 15 * 60_000);
  if (!emailRl.allowed) {
    // 노출 최소화: 동일한 ok 응답 반환 (enumeration 방지 동시에 DoS 방지)
    return NextResponse.json({ ok: true });
  }

  // redirectTo URL 구성 (현재 요청 호스트 기반)
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const redirectTo = host
    ? `${proto}://${host}${REDIRECT_PATH}`
    : REDIRECT_PATH;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // 실패해도 user enumeration 방지 위해 ok 반환
  }

  return NextResponse.json({ ok: true });
}
