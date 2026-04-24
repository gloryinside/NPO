"use client";

import { useEffect, useState } from "react";
import {
  readDonorLocaleFromDocument,
  type DonorLocale,
} from "@/lib/i18n/donor-client";
import { makeT, type TFn } from "@/lib/i18n/donor-messages";

/**
 * 클라이언트 컴포넌트용 translator.
 *
 * 첫 렌더는 서버에서 전달받은 locale(props) 또는 'ko' 로 시작,
 * 마운트 후 실제 쿠키 값으로 교체. SSR hydration 깜빡임이 신경 쓰이면
 * 서버 컴포넌트에서 getT() 결과를 props 로 내려 주는 쪽을 권장.
 */
export function useDonorT(initialLocale: DonorLocale = "ko"): TFn {
  const [locale, setLocale] = useState<DonorLocale>(initialLocale);
  useEffect(() => {
    setLocale(readDonorLocaleFromDocument());
  }, []);
  return makeT(locale);
}
