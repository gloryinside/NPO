/**
 * 금액/날짜 포맷 공용 헬퍼 — 화면마다 따로 만들지 말고 이것을 쓴다.
 *
 * 날짜는 항상 한국 시간(Asia/Seoul)으로 보여 준다. 서버(Vercel)는 UTC라서 timeZone 없이
 * toLocaleDateString을 쓰면 새벽 0~9시 사이 기록이 전날로 보였다.
 */

const TZ = "Asia/Seoul";
const KRW = new Intl.NumberFormat("ko-KR");

/** 12345 → "12,345원". 값이 없으면 "-" */
export function formatKRW(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "-";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "-";
  return KRW.format(n) + "원";
}

function toDate(value: string | Date): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026. 10. 17." (한국 시간). 값이 없으면 "-", 읽을 수 없는 값은 그대로 */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = toDate(value);
  return d ? d.toLocaleDateString("ko-KR", { timeZone: TZ }) : String(value);
}

/** "2026. 10. 17. 오후 3:04:05" (한국 시간). 값이 없으면 "-" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "-";
  const d = toDate(value);
  return d ? d.toLocaleString("ko-KR", { timeZone: TZ }) : String(value);
}

/** ISO 날짜 → "2026.10.17" (문자열 앞 10자리 그대로 — 날짜만 있는 값용) */
export function formatDateKR(iso: string | null | undefined): string {
  if (!iso) return "-";
  return iso.slice(0, 10).replace(/-/g, ".");
}
