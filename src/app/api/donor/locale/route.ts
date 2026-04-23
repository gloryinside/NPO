import { NextRequest, NextResponse } from "next/server";
import { checkCsrf } from "@/lib/security/csrf";
import {
  DONOR_LOCALES,
  LOCALE_COOKIE_NAME,
  type DonorLocale,
} from "@/lib/i18n/donor";

/**
 * G-D44: 언어 설정 저장 엔드포인트.
 * locale 쿠키 1년 유효. 서버 컴포넌트는 getT() 로 읽어감.
 */
export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;

  let body: { locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const locale = typeof body.locale === "string" ? body.locale : "";
  if (!(DONOR_LOCALES as readonly string[]).includes(locale)) {
    return NextResponse.json({ error: "unsupported locale" }, { status: 400 });
  }

  const res = NextResponse.json({ ok: true, locale });
  res.cookies.set({
    name: LOCALE_COOKIE_NAME,
    value: locale as DonorLocale,
    httpOnly: false, // JS에서도 읽을 수 있어야 토글 UI 동작
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });
  return res;
}
