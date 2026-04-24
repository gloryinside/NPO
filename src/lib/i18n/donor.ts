import { cookies } from "next/headers";
import {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
  type DonorLocale,
} from "./donor-client";

/**
 * G-D44: 후원자 포털 경량 i18n 계층 (서버 전용 함수).
 *
 * 전면 라우팅 국제화(e.g. /en/donor) 대신, locale 쿠키 + 작은 메시지 사전을
 * 쓰는 방식. 한국어가 기본이고 ko/en 두 언어만 현재 지원.
 *
 * 사용:
 *   const t = await getT()
 *   t("donor.login.title")
 *
 * 키가 없으면 원본 키 반환 (fallback 안전).
 *
 * 클라이언트에서 쓰는 상수/헬퍼는 `donor-client.ts`에서 직접 import.
 */

export {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
};
export type { DonorLocale };

const MESSAGES: Record<DonorLocale, Record<string, string>> = {
  ko: {
    "donor.nav.home": "홈",
    "donor.nav.promises": "약정",
    "donor.nav.payments": "납입",
    "donor.nav.receipts": "영수증",
    "donor.nav.impact": "임팩트",
    "donor.nav.cheer": "응원",
    "donor.nav.invite": "초대",
    "donor.nav.settings": "설정",
    "donor.fab.new_donation": "새 후원",
    "donor.offline.message": "오프라인 상태입니다. 일부 기능이 제한됩니다.",
    "donor.error.title": "일시적인 문제가 발생했습니다",
    "donor.error.retry": "다시 시도",
    "donor.empty.generic": "표시할 항목이 없습니다.",
    "donor.login.title": "후원자 로그인",
    "donor.signup.title": "후원자 회원가입",
    "donor.logout": "로그아웃",
    "donor.footer.privacy": "개인정보처리방침",
    "donor.footer.terms": "이용약관",
    "donor.footer.contact": "문의하기",
    "donor.session.expired.title": "세션이 만료되었습니다",
    "donor.session.expired.body": "30분 이상 활동이 없어 자동 로그아웃되었습니다.",
  },
  en: {
    "donor.nav.home": "Home",
    "donor.nav.promises": "Pledges",
    "donor.nav.payments": "Payments",
    "donor.nav.receipts": "Receipts",
    "donor.nav.impact": "Impact",
    "donor.nav.cheer": "Cheer",
    "donor.nav.invite": "Invite",
    "donor.nav.settings": "Settings",
    "donor.fab.new_donation": "Donate",
    "donor.offline.message": "You're offline. Some features are unavailable.",
    "donor.error.title": "Something went wrong",
    "donor.error.retry": "Retry",
    "donor.empty.generic": "No items to display.",
    "donor.login.title": "Donor Sign in",
    "donor.signup.title": "Create donor account",
    "donor.logout": "Sign out",
    "donor.footer.privacy": "Privacy Policy",
    "donor.footer.terms": "Terms of Service",
    "donor.footer.contact": "Contact",
    "donor.session.expired.title": "Session expired",
    "donor.session.expired.body":
      "You were logged out due to 30 minutes of inactivity.",
  },
};

export async function getDonorLocale(): Promise<DonorLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** 서버 컴포넌트에서 t 함수 획득 */
export async function getT(): Promise<(key: string) => string> {
  const locale = await getDonorLocale();
  const table = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  return (key: string) =>
    table[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
