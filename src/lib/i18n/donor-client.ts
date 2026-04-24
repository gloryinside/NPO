/**
 * Client-safe subset of donor i18n primitives.
 *
 * Split from `donor.ts` because that file imports `next/headers` (server-only),
 * which Turbopack refuses to bundle for the browser.
 */

export const DONOR_LOCALES = ["ko", "en"] as const;
export type DonorLocale = (typeof DONOR_LOCALES)[number];
export const DEFAULT_LOCALE: DonorLocale = "ko";
export const LOCALE_COOKIE_NAME = "donor-locale";

export function isValidLocale(s: string | undefined | null): s is DonorLocale {
  return !!s && (DONOR_LOCALES as readonly string[]).includes(s);
}

/** 클라이언트 측에서 쿠키 직접 읽기 (locale toggle 컴포넌트용) */
export function readDonorLocaleFromDocument(): DonorLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`),
  );
  const v = match ? decodeURIComponent(match[1]) : null;
  return isValidLocale(v) ? v : DEFAULT_LOCALE;
}
