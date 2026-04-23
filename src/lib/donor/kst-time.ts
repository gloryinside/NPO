/**
 * G-D42: 한국 표준시(KST) 기반 현재 날짜/연도/월 유틸.
 *
 * 서버(예: UTC) 런타임과 사용자 로컬이 다르면 연말/연초 경계에서
 * "올해"가 불일치할 수 있다. 후원 도메인은 한국 단일 시장이므로 KST 고정.
 *
 * 각 호출 시점의 현재 시각을 계산 — 모듈 로드 시점에 고정되지 않음.
 */
const KST_TZ = "Asia/Seoul";

export function kstNow(): Date {
  return new Date();
}

/** KST 기준 연/월/일 (1-indexed month) */
export function kstYmd(d: Date = kstNow()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: KST_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return { year, month, day };
}

export function kstCurrentYear(): number {
  return kstYmd().year;
}

export function kstCurrentMonth(): number {
  return kstYmd().month;
}
