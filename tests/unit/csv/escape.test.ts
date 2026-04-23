import { describe, it, expect } from 'vitest'
import { CSV_BOM, csvCell, csvRow } from '@/lib/csv/escape'

describe('csvCell', () => {
  it('null/undefined → 빈 문자열', () => {
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('일반 문자열은 그대로', () => {
    expect(csvCell('홍길동')).toBe('홍길동')
    expect(csvCell('abc123')).toBe('abc123')
  })

  it('숫자/boolean은 String()', () => {
    expect(csvCell(123)).toBe('123')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(true)).toBe('true')
    expect(csvCell(false)).toBe('false')
  })

  it('쉼표 포함 시 따옴표로 감쌈', () => {
    expect(csvCell('a,b')).toBe('"a,b"')
  })

  it('따옴표 포함 시 이중화 + 감쌈', () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
  })

  it('개행 포함 시 감쌈 (LF/CR 모두)', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"')
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"')
  })

  it('혼합 특수문자 (실제 reason 필드 시나리오)', () => {
    expect(csvCell('업그레이드, "가족 생일" 기념\n감사합니다')).toBe(
      '"업그레이드, ""가족 생일"" 기념\n감사합니다"',
    )
  })
})

describe('csvRow', () => {
  it('일반 값 콤마 조인', () => {
    expect(csvRow(['a', 'b', 'c'])).toBe('a,b,c')
  })

  it('빈 배열은 빈 문자열', () => {
    expect(csvRow([])).toBe('')
  })

  it('null 혼재', () => {
    expect(csvRow(['a', null, 'c'])).toBe('a,,c')
  })

  it('특수문자 셀은 개별 escape 후 조인', () => {
    expect(csvRow(['홍길동', '업, 다운', 123])).toBe('홍길동,"업, 다운",123')
  })
})

describe('CSV_BOM', () => {
  it('UTF-8 BOM (U+FEFF) 1글자', () => {
    expect(CSV_BOM).toHaveLength(1)
    expect(CSV_BOM.charCodeAt(0)).toBe(0xfeff)
  })
})
