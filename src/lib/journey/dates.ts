/** 여정 메시지 날짜 계산 — KST 'YYYY-MM-DD' 문자열 기준, 순수 함수 */

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isLeap(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** 오늘을 기념일로 보는 (월, 일들) — 평년 2/28에는 2/29생도 포함 */
export function anniversaryDays(today: string): { month: number; days: number[] } {
  const [y, m, d] = today.split("-").map(Number);
  const days = m === 2 && d === 28 && !isLeap(y) ? [28, 29] : [d];
  return { month: m, days };
}

/** KST 하루를 UTC 시각 범위로 — timestamptz 비교용 */
export function kstDayRange(date: string): { from: string; to: string } {
  return { from: `${date}T00:00:00+09:00`, to: `${addDays(date, 1)}T00:00:00+09:00` };
}

/** 시작일부터 오늘까지 꽉 찬 햇수 */
export function fullYears(start: string, today: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let years = ty - sy;
  // 2/29 시작은 평년 2/28을 기념일로 본다(anniversaryDays와 같은 규칙)
  const feb29OnFeb28 = sm === 2 && sd === 29 && tm === 2 && td === 28 && !isLeap(ty);
  if (!feb29OnFeb28 && (tm < sm || (tm === sm && td < sd))) years -= 1;
  return Math.max(0, years);
}
