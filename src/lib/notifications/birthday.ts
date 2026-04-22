/**
 * 생일 축하 스케줄러 helper.
 *
 * KST 기준 '오늘'에 해당하는 월-일(MM-DD)을 계산한다.
 * birth_date는 'YYYY-MM-DD' 텍스트로 저장되므로 LIKE로 MM-DD 매칭.
 *
 * 2/29 생일자는 비윤년에 3/1로 이동 — `resolveBirthdayMatch`에서 처리.
 */

/** UTC 시각을 KST로 변환한 Date (시간대 조정, Date 객체 그대로) */
function toKst(now: Date): Date {
  return new Date(now.getTime() + 9 * 60 * 60 * 1000);
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * KST '오늘' 기준으로 축하 대상이 될 MM-DD 패턴 리스트.
 *
 * - 보통은 한 개: ['04-23']
 * - 3/1이고 비윤년이면: ['02-29', '03-01'] 두 개 매칭 (2/29 생일자 + 3/1 생일자)
 */
export function resolveBirthdayMatches(now: Date): string[] {
  const kst = toKst(now);
  const year = kst.getUTCFullYear();
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const today = `${pad(month)}-${pad(day)}`;

  if (month === 3 && day === 1 && !isLeapYear(year)) {
    return ['02-29', today];
  }
  return [today];
}

/**
 * 'YYYY-MM-DD'에서 MM-DD 부분만 추출. 포맷이 다르면 null.
 */
export function extractMonthDay(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const m = birthDate.match(/^\d{4}-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}
