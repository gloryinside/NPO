import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { checkRrn, checkBizNo, maskRrn, checkOrgForReceipt } from '@/lib/receipt/validation'
import { deductibleAmount } from '@/lib/receipt/issue'
import { buildNtsDataset, NTS_COLUMNS } from '@/lib/receipt/nts-dataset'
import { buildXlsx } from '@/lib/export/xlsx'

/** 검증식으로 유효한 사업자번호를 만든다(실존 번호를 테스트에 쓰지 않기 위해) */
function makeBizNo(first9: string): string {
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(first9[i]) * w[i]
  sum += Math.floor((Number(first9[8]) * 5) / 10)
  return first9 + String((10 - (sum % 10)) % 10)
}
const VALID_BIZ = makeBizNo('123456789')

describe('checkRrn — 형식·생년월일·성별 자리(체크섬 미적용)', () => {
  it('2020-10 이후 무작위 뒷자리 번호도 통과', () => {
    expect(checkRrn('950101-1999999')).toMatchObject({ ok: true, kind: 'resident', birth: '1995-01-01' })
  })
  it('2000년대생(3·4)·외국인(5~8)', () => {
    expect(checkRrn('0502143123456')).toMatchObject({ ok: true, birth: '2005-02-14' })
    expect(checkRrn('8807075123456')).toMatchObject({ ok: true, kind: 'foreigner' })
  })
  it('없는 날짜·미래 생일·자릿수 오류 거부', () => {
    expect(checkRrn('950230-1234567')).toEqual({ ok: false, reason: 'birth_date' })
    expect(checkRrn('300101-3234567', new Date('2026-10-16'))).toEqual({ ok: false, reason: 'birth_date' })
    expect(checkRrn('95010-1234567')).toEqual({ ok: false, reason: 'format' })
  })
  it('마스킹', () => {
    expect(maskRrn('9501011234567')).toBe('950101-1******')
  })
})

describe('checkBizNo — 검증번호', () => {
  it('맞는 번호 통과, 끝자리 틀리면 거부', () => {
    expect(checkBizNo(VALID_BIZ)).toBe(true)
    const wrong = VALID_BIZ.slice(0, 9) + String((Number(VALID_BIZ[9]) + 1) % 10)
    expect(checkBizNo(wrong)).toBe(false)
  })
})

describe('checkOrgForReceipt — 법정 기재사항', () => {
  it('대표자·소재지 없으면 발급 차단', () => {
    const issues = checkOrgForReceipt({ name: '재단', business_no: VALID_BIZ })
    expect(issues.filter((i) => i.blocking).map((i) => i.field).sort()).toEqual(['address', 'donation_type_code', 'representative_name'])
  })
  it('기부금 유형 코드는 별지 제45호서식 코드만', () => {
    const base = { name: '재단', business_no: VALID_BIZ, address: '서울', representative_name: '홍길동' }
    expect(checkOrgForReceipt({ ...base, donation_type_code: '40' }).filter((i) => i.blocking)).toHaveLength(0)
    expect(checkOrgForReceipt({ ...base, donation_type_code: '99' }).map((i) => i.field)).toContain('donation_type_code')
  })
})

describe('deductibleAmount — 환불 반영', () => {
  it('완료=전액, 부분환불=순액, 전액환불=0', () => {
    expect(deductibleAmount({ amount: 30000, refund_amount: null, pay_status: 'paid' })).toBe(30000)
    expect(deductibleAmount({ amount: 30000, refund_amount: 10000, pay_status: 'refunded' })).toBe(20000)
    expect(deductibleAmount({ amount: 30000, refund_amount: null, pay_status: 'refunded' })).toBe(0)
    expect(deductibleAmount({ amount: 30000, refund_amount: null, pay_status: 'failed' })).toBe(0)
  })
})

describe('buildNtsDataset — 제외는 사유와 함께', () => {
  const org = { name: '재단', business_no: VALID_BIZ, address: '서울', representative_name: '홍길동', donee_code: 'AAA', donation_type_code: '40' }
  const ds = buildNtsDataset(org, 2026, [
    { receiptCode: 'RCP-2026-00001', issuedAt: '2027-01-05T00:00:00Z', donorName: '김후원', donorId: '9501011234567', totalAmount: 360000 },
    { receiptCode: 'RCP-2026-00002', issuedAt: null, donorName: '이후원', donorId: null, totalAmount: 120000 },
    { receiptCode: 'RCP-2026-00003', issuedAt: null, donorName: '(주)기업', donorId: VALID_BIZ, totalAmount: 1000000 },
    { receiptCode: 'RCP-2026-00004', issuedAt: null, donorName: '박후원', donorId: '9502301234567', totalAmount: 50000 },
  ])
  it('유효 행만 포함하고 합계를 맞춘다', () => {
    expect(ds.rows.map((r) => r.donorType)).toEqual(['개인', '법인'])
    expect(ds.totalAmount).toBe(1360000)
    expect(ds.rows[0].seq).toBe(1)
  })
  it('주민번호 없음·형식 오류는 excluded에 사유와 함께', () => {
    expect(ds.excluded.map((e) => e.receiptCode)).toEqual(['RCP-2026-00002', 'RCP-2026-00004'])
    expect(ds.excluded[0].reason).toContain('미수집')
  })
  it('기관 기재사항 문제 없음', () => {
    expect(ds.orgIssues.filter((i) => i.blocking)).toHaveLength(0)
  })
  it('엑셀에 기부유형코드 열이 있고 기관 값이 들어간다', () => {
    const col = NTS_COLUMNS.find((c) => c.header === '기부유형코드')!
    expect(col.value(ds.rows[0], { name: '재단', bizNo: VALID_BIZ, doneeCode: 'AAA', typeCode: '40' })).toBe('40')
  })
  it('같은 주민번호는 한 줄로 합산(홈택스는 번호 중복을 오류로 거부)', () => {
    const d = buildNtsDataset(org, 2026, [
      { receiptCode: 'RCP-A', issuedAt: null, donorName: '김후원', donorId: '950101-1234567', totalAmount: 100000 },
      { receiptCode: 'RCP-B', issuedAt: null, donorName: '김후원', donorId: '9501011234567', totalAmount: 50000 },
    ])
    expect(d.rows).toHaveLength(1)
    expect(d.rows[0].amount).toBe(150000)
    expect(d.totalAmount).toBe(150000)
    expect(d.merged).toEqual([{ receiptCode: 'RCP-B', donorName: '김후원', mergedInto: 'RCP-A' }])
  })
})

describe('buildXlsx', () => {
  it('열 머리글과 주민번호(앞자리 0 보존 문자열)가 들어간 유효한 xlsx', async () => {
    const buf = await buildXlsx('발급명세', NTS_COLUMNS.map((c) => c.header), [['1', '0502143123456', 360000]])
    const zip = await JSZip.loadAsync(buf)
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheet).toContain('주민등록번호(사업자등록번호)')
    expect(sheet).toContain('<t xml:space="preserve">0502143123456</t>')
    expect(sheet).toContain('<v>360000</v>')
  })
})
