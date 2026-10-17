/**
 * 한국 시간(KST, UTC+9) 날짜 계산 — 서버 시간대(UTC)와 무관하게.
 * 결제일·연도 경계(영수증 귀속연도)는 모두 KST 기준이다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** KST 기준 시각의 UTC 필드를 읽기 위한 Date (getUTC*로 읽을 것) */
export function kstNow(now: Date = new Date()): Date {
  return new Date(now.getTime() + KST_OFFSET_MS)
}

/** KST 오늘 날짜 'YYYY-MM-DD' */
export function kstToday(now: Date = new Date()): string {
  return kstNow(now).toISOString().slice(0, 10)
}

/** KST 기준 일(1~31)·월(1~12)·연도 */
export function kstParts(now: Date = new Date()): { year: number; month: number; day: number } {
  const k = kstNow(now)
  return { year: k.getUTCFullYear(), month: k.getUTCMonth() + 1, day: k.getUTCDate() }
}

/** 해당 월의 마지막 날(1~31) */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}
