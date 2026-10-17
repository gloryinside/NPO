// @vitest-environment node
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { buildReceiptDocDefinition, displayDonorId, generateReceiptPdf, koreanDate, type ReceiptData } from '@/lib/receipt/pdf'
import { donorAddress } from '@/lib/receipt/issue'

const sample: ReceiptData = {
  receiptCode: 'RCP-2026-00001',
  year: 2026,
  org: { name: '희망나눔재단', businessNo: '1048211111', address: '서울특별시 중구 세종대로 1', representativeName: '홍길동', doneeLegalBasis: '「소득세법 시행령」 제80조제1항제5호', donationTypeCode: '40' },
  member: { name: '김후원', idNumber: '9001011234567', address: '(04524) 서울특별시 중구 명동길 1 101호' },
  totalAmount: 60000,
  payments: [
    { payDate: '2026-01-15', campaignTitle: '정기후원', amount: 30000 },
    { payDate: '2026-02-15', campaignTitle: '정기후원', amount: 30000 },
  ],
  issuedAt: '2026-12-31T16:00:00.000Z', // KST 2027-01-01
  verifyUrl: 'https://hope.example.org/verify/receipt/abc',
}

describe('기부금영수증 PDF(별지 제45호의2)', () => {
  it('주민등록번호는 가리고 사업자등록번호는 그대로 표기', () => {
    expect(displayDonorId('9001011234567')).toBe('900101-1******')
    expect(displayDonorId('1048211111')).toBe('104-82-11111')
    expect(displayDonorId(null)).toBe('')
  })

  it('발급일은 한국 시간으로 적는다', () => {
    expect(koreanDate('2026-12-31T16:00:00.000Z')).toBe('2027년 1월 1일')
  })

  it('서식의 항목·문구를 모두 담는다', () => {
    const text = JSON.stringify(buildReceiptDocDefinition(sample))
    for (const s of ['별지 제45호의2서식', '일련번호', '❶ 기부자', '❷ 기부금 단체', '❸ 기부금 모집처', '❹ 기부내용',
      '기부금공제대상', '품명', '수량', '단가', '신청인', '기부금 수령인', '위와 같이 기부금을 기부받았음을 증명합니다.',
      '900101-1******', '금전', '희망나눔재단 대표 홍길동', '「조세특례제한법」 제76조ㆍ제88조의4']) {
      expect(text).toContain(s)
    }
    // 2021 개정으로 없어진 칸·조문
    for (const s of ['기부장려금', '공제대상\\n기부금액', '제75조']) expect(text).not.toContain(s)
    expect(text).not.toContain('9001011234567')
  })

  it('주소는 우편번호를 앞에 붙여 한 줄로', () => {
    expect(donorAddress({ postal_code: '04524', address_line1: '서울 중구 명동길 1', address_line2: '101호' })).toBe('(04524) 서울 중구 명동길 1 101호')
    expect(donorAddress({ address_line1: null })).toBeNull()
  })

  it('PDF가 만들어진다', async () => {
    const buf = await generateReceiptPdf(sample)
    expect(buf.subarray(0, 4).toString()).toBe('%PDF')
    if (process.env.RECEIPT_PDF_OUT) fs.writeFileSync(process.env.RECEIPT_PDF_OUT, buf)
  })
})
