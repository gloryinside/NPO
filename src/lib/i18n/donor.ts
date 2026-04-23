import { cookies } from "next/headers";

/**
 * G-D44: 후원자 포털 경량 i18n 계층.
 *
 * 전면 라우팅 국제화(e.g. /en/donor) 대신, locale 쿠키 + 작은 메시지 사전을
 * 쓰는 방식. 한국어가 기본이고 ko/en 두 언어만 현재 지원.
 *
 * 사용:
 *   const t = await getT()
 *   t("donor.login.title")
 *
 * 키가 없으면 원본 키 반환 (fallback 안전).
 */

export const DONOR_LOCALES = ["ko", "en"] as const;
export type DonorLocale = (typeof DONOR_LOCALES)[number];
export const DEFAULT_LOCALE: DonorLocale = "ko";
export const LOCALE_COOKIE_NAME = "donor-locale";

const MESSAGES: Record<DonorLocale, Record<string, string>> = {
  ko: {
    "donor.nav.home": "홈",
    "donor.nav.promises": "약정",
    "donor.nav.payments": "납입",
    "donor.nav.impact": "임팩트",
    "donor.nav.settings": "설정",
    "donor.fab.new_donation": "새 후원",
    "donor.offline.message": "오프라인 상태입니다. 일부 기능이 제한됩니다.",
    "donor.error.title": "일시적인 문제가 발생했습니다",
    "donor.error.retry": "다시 시도",
    "donor.empty.generic": "표시할 항목이 없습니다.",
  },
  en: {
    "donor.nav.home": "Home",
    "donor.nav.promises": "Pledges",
    "donor.nav.payments": "Payments",
    "donor.nav.impact": "Impact",
    "donor.nav.settings": "Settings",
    "donor.fab.new_donation": "Donate",
    "donor.offline.message": "You're offline. Some features are unavailable.",
    "donor.error.title": "Something went wrong",
    "donor.error.retry": "Retry",
    "donor.empty.generic": "No items to display.",
  },
};

export function isValidLocale(s: string | undefined | null): s is DonorLocale {
  return !!s && (DONOR_LOCALES as readonly string[]).includes(s);
}

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

/** 클라이언트 측에서 쿠키 직접 읽기 (locale toggle 컴포넌트용) */
export function readDonorLocaleFromDocument(): DonorLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`)
  );
  const v = match ? decodeURIComponent(match[1]) : null;
  return isValidLocale(v) ? v : DEFAULT_LOCALE;
}
