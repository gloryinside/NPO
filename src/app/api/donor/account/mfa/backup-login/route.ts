import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { consumeBackupCode } from "@/lib/auth/backup-codes";
import {
  issueMfaBypassToken,
  MFA_BYPASS_COOKIE,
  MFA_BYPASS_TTL_SECONDS,
} from "@/lib/auth/mfa-bypass";
import { checkCsrf } from "@/lib/security/csrf";
import { rateLimit } from "@/lib/rate-limit";

/**
 * SP-5 후속: 백업 코드로 MFA 우회 로그인.
 *
 * 전제: aal1 Supabase 세션이 이미 확립된 상태(이메일/비밀번호 통과 직후).
 * 동작:
 *   1. 요청 body 의 code 를 member 의 미사용 백업 코드와 비교
 *   2. 매칭되면 used_at 처리 + donor-mfa-bypass 쿠키 발급 (TTL 15분)
 *   3. 이후 getDonorSession 이 bypass 쿠키를 인식해 MFA 가드 통과
 *
 * 매칭 실패는 brute-force 방지를 위해 rate-limit.
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "이메일/비밀번호 로그인을 먼저 완료해 주세요." },
      { status: 401 },
    );
  }

  // IP 기반 + 사용자 기반 rate-limit (10req/10min)
  const rl = rateLimit(`mfa-backup:${user.id}`, 10, 10 * 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: "너무 많은 시도입니다. 10분 후 다시 시도해 주세요.",
      },
      { status: 429 },
    );
  }

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (!code) {
    return NextResponse.json(
      { error: "백업 코드를 입력해 주세요." },
      { status: 400 },
    );
  }

  const admin = createSupabaseAdminClient();
  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("supabase_uid", user.id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json(
      { error: "계정 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const consumed = await consumeBackupCode(
    admin,
    (member as { id: string }).id,
    code,
  );
  if (!consumed) {
    return NextResponse.json(
      { error: "백업 코드가 올바르지 않거나 이미 사용되었습니다." },
      { status: 400 },
    );
  }

  // bypass 쿠키 발급
  const token = issueMfaBypassToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set({
    name: MFA_BYPASS_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MFA_BYPASS_TTL_SECONDS,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
