// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { buildDomesticByMonth, buildDomesticByYear, buildDraft, buildMonths, checkForm, parseForm, totals } from '@/lib/disclosure/nts-63-7'
import { buildNts637DocDefinition, generateNts637Pdf } from '@/lib/disclosure/nts-63-7-pdf'

const expense = [
  { date: '2025-01-10', purpose: '장학금 지급', payee: '김우수', amount: 100_000 },
  { date: '2025-01-20', purpose: '장학금 지급', payee: '이성실', amount: 900_000 },
  { date: '2025-02-05', purpose: '장학금 지급', payee: '김우수', amount: 1_000_000 },
  { date: '2025-02-11', purpose: '복지단체 지원', payee: 'A복지단체', amount: 10_000_000 },
]
const income = [
  { date: '2025-01-03', amount: 5_000_000 },
  { date: '2025-02-03', amount: 7_000_000 },
  { date: '2025-12-31', amount: 1_000 },
]

describe('별지 제63호의7서식 초안', () => {
  it('월별 수입·지출과 전기이월부터 누적한 잔액', () => {
    const m = buildMonths(2025, 1_000_000, income, expense)
    expect(m).toHaveLength(12)
    expect(m[0]).toEqual({ month: '2025-01', income: 5_000_000, expense: 1_000_000, balance: 5_000_000 })
    expect(m[1]).toEqual({ month: '2025-02', income: 7_000_000, expense: 11_000_000, balance: 1_000_000 })
    expect(m[11]!.balance).toBe(1_001_000)
  })

  it('지출월별·지급목적별 묶음, 대표 지급처는 가장 많이 받은 곳', () => {
    expect(buildDomesticByMonth(expense)).toEqual([
      { month: '2025-01', purpose: '장학금 지급', count: 2, payee: '이성실', amount: 1_000_000 },
      { month: '2025-02', purpose: '복지단체 지원', count: 1, payee: 'A복지단체', amount: 10_000_000 },
      { month: '2025-02', purpose: '장학금 지급', count: 1, payee: '김우수', amount: 1_000_000 },
    ])
  })

  it('연도별: 1개 단체 연 100만원 이상은 따로, 나머지는 목적별 합산, 수혜인원은 비움', () => {
    expect(buildDomesticByYear(2025, expense)).toEqual([
      { year: '2025', purpose: '복지단체 지원', beneficiaries: null, payee: 'A복지단체', amount: 10_000_000 },
      { year: '2025', purpose: '장학금 지급', beneficiaries: null, payee: '김우수', amount: 1_100_000 },
      { year: '2025', purpose: '장학금 지급', beneficiaries: null, payee: '이성실', amount: 900_000 },
    ])
  })

  it('기관이 적을 칸(구분·지정일·수혜인원)은 비워 두고 고칠 점으로 알린다', () => {
    const form = buildDraft({
      year: 2025,
      org: { name: '테스트재단', businessNo: '1048211111', representative: '홍대표', email: null, phone: null, address: null },
      income, expense, today: '2026-04-30',
    })
    expect(form.basic).toMatchObject({ orgName: '테스트재단', orgCategory: '', designatedAt: '', fiscalYear: '2025년' })
    const w = checkForm(form)
    expect(w.some((s) => s.includes('④'))).toBe(true)
    expect(w.some((s) => s.includes('⑧'))).toBe(true)
    expect(w.some((s) => s.includes('수혜인원'))).toBe(true)
    expect(w.some((s) => s.includes('합계'))).toBe(false) // 국내 합 = 월별 지출 합
    expect(totals(form)).toMatchObject({ income: 12_001_000, expense: 12_000_000, carriedOut: 1_000, domestic: 12_000_000 })
  })
})

describe('저장 값 정리', () => {
  const base = buildDraft({
    year: 2025, org: { name: 'x', businessNo: null, representative: null, email: null, phone: null, address: null },
    income, expense, today: '2026-04-30',
  })

  it('잔액은 서버가 다시 계산하고, 구분은 서식 선택지만', () => {
    const tampered = { ...base, carriedIn: 500, months: base.months.map((m) => ({ ...m, balance: 999 })) }
    const r = parseForm(tampered)
    expect(r.ok && r.value.months[0]!.balance).toBe(500 + 5_000_000 - 1_000_000)
    expect(parseForm({ ...base, basic: { ...base.basic, orgCategory: '아무거나' } }).ok).toBe(false)
    expect(parseForm({ ...base, basic: { ...base.basic, orgCategory: '사회복지법인' } }).ok).toBe(true)
    expect(parseForm({ ...base, months: base.months.slice(0, 11) }).ok).toBe(false)
    expect(parseForm(null).ok).toBe(false)
  })
})

describe('서식 PDF', () => {
  it('서식 번호·제목·근거 문구가 그대로 들어간다', async () => {
    const form = buildDraft({
      year: 2025, org: { name: '테스트재단', businessNo: '1048211111', representative: '홍대표', email: 'a@b.org', phone: '02-000-0000', address: '서울' },
      income, expense, today: '2026-04-30',
    })
    const json = JSON.stringify(buildNts637DocDefinition(form))
    for (const s of ['[별지 제63호의7서식] <개정 2022. 3. 18.>', '연간 기부금 모금액 및 활용실적 명세서', '⑩ 월별', '㉟ 금액',
      '「법인세법 시행령」 제38조제8항 또는 제39조제5항에 따라 연간 기부금 모금액 및 활용실적을 공개합니다.', '2026년 4월 30일', '(공익법인등의 직인)']) {
      expect(json).toContain(s)
    }
    const pdf = await generateNts637Pdf(form)
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})
