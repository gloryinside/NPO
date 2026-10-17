/**
 * 국세청 제출용 기부자별 발급명세 데이터 — 순수 함수(검증 + 행 생성).
 *
 * 근거
 *  - 기부금영수증 발급명세(소득세법 시행규칙 별지 제29호의7서식 · 법인세법 시행규칙 별지 제75호의3서식):
 *    귀속연도, 단체명, 사업자등록번호, 기부자별 발급명세(일련번호·기부자·금액 등).
 *  - 전자기부금영수증(홈택스) 일괄발급: 홈택스 제공 엑셀 양식 또는 후원관리 프로그램 자료를 변환해 업로드.
 *    국세청 공개 안내에는 양식의 열 구성이 명시돼 있지 않다 → 열 순서는 NTS_COLUMNS 한 곳에서만 정의하고,
 *    그해 홈택스에서 받은 양식과 맞춰 조정한다. (예전 구현의 100바이트 고정길이 파일은 공식 규격이 아니었다)
 *
 * 금지: 주민등록번호가 없거나 형식이 틀린 기부자를 조용히 빼지 않는다 — excluded에 사유와 함께 남긴다.
 */
import { checkBizNo, checkRrn, normalizeDigits, type OrgReceiptFields, checkOrgForReceipt, type FieldIssue } from './validation'

export type NtsSourceRow = {
  receiptCode: string
  issuedAt: string | null
  donorName: string
  /** 복호화된 주민등록번호 또는 사업자등록번호(법인 기부자). 없으면 null */
  donorId: string | null
  totalAmount: number
}

export type NtsRow = {
  seq: number
  receiptCode: string
  issuedDate: string
  donorType: '개인' | '외국인' | '법인'
  donorName: string
  donorId: string
  donationKind: '금전'
  amount: number
  year: number
}

export type NtsExcluded = { receiptCode: string; donorName: string; reason: string }

/** 같은 주민(사업자)번호로 합쳐진 영수증 — 홈택스는 한 파일 안의 번호 중복을 오류로 거부한다 */
export type NtsMerged = { receiptCode: string; donorName: string; mergedInto: string }

/** 엑셀 열 정의 — 홈택스 최신 양식에 맞춰 여기만 고친다 */
export const NTS_COLUMNS: Array<{ header: string; value: (r: NtsRow, org: { name: string; bizNo: string; doneeCode: string; typeCode: string }) => string | number }> = [
  { header: '일련번호', value: (r) => r.seq },
  { header: '귀속연도', value: (r) => String(r.year) },
  { header: '기부금단체 사업자등록번호', value: (_, o) => o.bizNo },
  { header: '기부금단체명', value: (_, o) => o.name },
  { header: '기부금단체코드', value: (_, o) => o.doneeCode },
  { header: '기부유형코드', value: (_, o) => o.typeCode },
  { header: '영수증 일련번호', value: (r) => r.receiptCode },
  { header: '발급일자', value: (r) => r.issuedDate },
  { header: '기부자 구분', value: (r) => r.donorType },
  { header: '기부자 성명(상호)', value: (r) => r.donorName },
  { header: '주민등록번호(사업자등록번호)', value: (r) => r.donorId },
  { header: '기부 내용', value: (r) => r.donationKind },
  { header: '기부금액', value: (r) => r.amount },
]

export function buildNtsDataset(
  org: OrgReceiptFields,
  year: number,
  source: NtsSourceRow[],
): { rows: NtsRow[]; excluded: NtsExcluded[]; merged: NtsMerged[]; orgIssues: FieldIssue[]; totalAmount: number } {
  const orgIssues = checkOrgForReceipt(org)
  const rows: NtsRow[] = []
  const excluded: NtsExcluded[] = []
  const merged: NtsMerged[] = []
  const byId = new Map<string, NtsRow>()

  for (const s of source) {
    if (!(s.totalAmount > 0)) {
      excluded.push({ receiptCode: s.receiptCode, donorName: s.donorName, reason: '공제 대상 금액 없음' })
      continue
    }
    const id = s.donorId ? normalizeDigits(s.donorId) : ''
    let donorType: NtsRow['donorType'] | null = null
    if (id.length === 13) {
      const c = checkRrn(id)
      if (c.ok) donorType = c.kind === 'foreigner' ? '외국인' : '개인'
      else {
        excluded.push({ receiptCode: s.receiptCode, donorName: s.donorName, reason: '주민등록번호 형식 오류' })
        continue
      }
    } else if (id.length === 10) {
      if (checkBizNo(id)) donorType = '법인'
      else {
        excluded.push({ receiptCode: s.receiptCode, donorName: s.donorName, reason: '사업자등록번호 검증번호 오류' })
        continue
      }
    } else {
      excluded.push({ receiptCode: s.receiptCode, donorName: s.donorName, reason: '주민등록번호 미수집(연말정산 간소화 제출 불가)' })
      continue
    }
    const prev = byId.get(id)
    if (prev) {
      // 한 사람이 회원 레코드를 여러 개 가진 경우 등 — 금액을 합쳐 한 줄로(제출 시 번호 중복 오류 방지)
      prev.amount += Math.round(s.totalAmount)
      merged.push({ receiptCode: s.receiptCode, donorName: s.donorName, mergedInto: prev.receiptCode })
      continue
    }
    const row: NtsRow = {
      seq: rows.length + 1,
      receiptCode: s.receiptCode,
      issuedDate: (s.issuedAt ?? '').slice(0, 10),
      donorType,
      donorName: s.donorName.trim(),
      donorId: id,
      donationKind: '금전',
      amount: Math.round(s.totalAmount),
      year,
    }
    byId.set(id, row)
    rows.push(row)
  }

  return { rows, excluded, merged, orgIssues, totalAmount: rows.reduce((a, r) => a + r.amount, 0) }
}
