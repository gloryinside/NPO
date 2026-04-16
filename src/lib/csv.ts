/**
 * CSV 직렬화 헬퍼
 *
 * 한국어 엑셀에서 한글이 깨지지 않도록 UTF-8 BOM을 앞에 붙인다.
 */

/** 한 셀 값을 CSV-safe 문자열로 변환 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "string" ? value : String(value);
  // 쉼표, 따옴표, 개행이 있으면 따옴표로 감싸고 내부 따옴표는 두 번
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * rows 를 CSV 문자열로 직렬화.
 * 첫 번째 요소는 헤더 배열.
 */
export function toCsv(header: string[], rows: Array<Array<unknown>>): string {
  const head = header.map(csvCell).join(",");
  const body = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  // UTF-8 BOM 포함
  return `\uFEFF${head}\n${body}\n`;
}

/**
 * NextResponse 에서 쓸 수 있는 CSV HTTP 응답 헤더 세트.
 */
export function csvHeaders(filename: string): HeadersInit {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    "Cache-Control": "no-store",
  };
}
