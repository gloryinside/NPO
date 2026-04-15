/**
 * 금액/날짜 포맷 공용 헬퍼.
 * 원화 표기, ISO 날짜 → "YYYY.MM.DD" 변환 등 UI 전반에서 재사용.
 */

export function formatKRW(amount: number): string {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export function formatDateKR(iso: string | null | undefined): string {
  if (!iso) return "-";
  // "2026-04-15T..." or "2026-04-15" → "2026.04.15"
  return iso.slice(0, 10).replace(/-/g, ".");
}
