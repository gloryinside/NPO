import { NextRequest, NextResponse } from "next/server";
import { adminClaims } from "@/lib/auth/tenant-binding";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { readJsonObject } from "@/lib/http/body";

/**
 * G-D100: 관리자 비밀번호 재설정 이메일 발송.
 *
 * - admin role 을 가진 계정인지 먼저 확인 (service role 로 auth.users 조회)
 *   → 존재하지 않는 이메일/비-admin 에는 동일한 ok 응답 (enumeration 방지)
 * - Supabase auth.resetPasswordForEmail 호출
 * - Rate limit: IP 15분 10회 + email 15분 3회
 */
const REDIRECT_PATH = "/admin/password/reset";

export async function POST(req: NextRequest) {

  const parsed = await readJsonObject<{ email?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json(
      { error: "유효한 이메일을 입력하세요." },
      { status: 400 }
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!rateLimit(`adm-pwreset:ip:${ip}`, 10, 15 * 60_000).allowed) {
    return NextResponse.json(
      { error: "요청이 너무 많습니다." },
      { status: 429 }
    );
  }
  if (!rateLimit(`adm-pwreset:email:${email}`, 3, 15 * 60_000).allowed) {
    return NextResponse.json({ ok: true });
  }

  // admin 계정인지 확인 (service role)
  try {
    const admin = createSupabaseAdminClient();
    const { data: usersPage } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 50,
    });
    const match = (usersPage?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email
    );
    if (!match || !adminClaims(match)) {
      // enumeration 방지: 동일한 ok 응답
      return NextResponse.json({ ok: true });
    }
  } catch {
    return NextResponse.json({ ok: true });
  }

  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const redirectTo = host
    ? `${proto}://${host}${REDIRECT_PATH}`
    : REDIRECT_PATH;

  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  } catch {
    // swallow
  }

  return NextResponse.json({ ok: true });
}
