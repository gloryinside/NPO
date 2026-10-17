import { NextRequest, NextResponse } from "next/server";
import {
  DONOR_LOCALES,
  LOCALE_COOKIE_NAME,
  type DonorLocale,
} from "@/lib/i18n/donor";
import { readJsonObject } from "@/lib/http/body";

/**
 * G-D44: 언어 설정 저장 엔드포인트.
 * locale 쿠키 1년 유효. 서버 컴포넌트는 getT() 로 읽어감.
 */
export async function POST(req: NextRequest) {

  const parsed = await readJsonObject<{ locale?: unknown }>(req);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;

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
