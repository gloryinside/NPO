/**
 * RFC 4180 준수 CSV escaping + UTF-8 BOM 유틸.
 *
 * 사용 패턴:
 *   const body = [csvRow(HEADERS), ...rows.map((r) => csvRow(toCells(r)))].join('\n')
 *   const output = CSV_BOM + body
 *   return new Response(output, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } })
 */

/** UTF-8 BOM — Excel(Windows)에서 한글 깨짐 방지. Google Sheets/Numbers는 BOM 유무 무관. */
export const CSV_BOM = '﻿'

/**
 * 단일 셀을 CSV-safe 문자열로 변환.
 * - null/undefined → 빈 문자열
 * - 숫자/boolean → String()
 * - 문자열에 `,` / `"` / `\n` / `\r` 포함 시 `"..."`로 감싸고 내부 `"` → `""` 이중화
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** 셀 배열을 한 줄(CSV row)로. 줄 끝 개행은 호출자가 추가. */
export function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',')
}
