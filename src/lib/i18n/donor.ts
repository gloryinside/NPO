import { cookies } from "next/headers";
import {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
  type DonorLocale,
} from "./donor-client";
import { makeT, type TFn } from "./donor-messages";

/**
 * G-D44: 후원자 포털 경량 i18n 계층 (서버 전용 함수).
 *
 * 사용:
 *   const t = await getT()
 *   t("donor.login.title")
 *   t("donor.mfa.backup.remaining", { count: 7 })
 *
 * 키가 없으면 원본 키 반환 (fallback 안전).
 * 메시지 사전은 donor-messages.ts 에서 관리 (서버/클라이언트 공유).
 */

export {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
};
export type { DonorLocale, TFn };

export async function getDonorLocale(): Promise<DonorLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** 서버 컴포넌트에서 t 함수 획득 */
export async function getT(): Promise<TFn> {
  const locale = await getDonorLocale();
  return makeT(locale);
}
