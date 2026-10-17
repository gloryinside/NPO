/**
 * 기부금영수증·국세청 자료 검증 — 순수 함수.
 *
 * 주민등록번호: 2020-10 이후 새로 부여된 번호는 뒤 6자리가 무작위라 예전 검증식(체크섬)이
 * 정상 번호도 틀렸다고 판정한다. 그래서 형식·생년월일·성별(세기) 자리만 검증하고 체크섬은 보지 않는다.
 * 외국인등록번호(성별 자리 5~8)도 같은 구조로 받는다.
 * 사업자등록번호: 공개된 검증식(가중치 1,3,7,1,3,7,1,3,5)으로 체크 디지트까지 확인한다.
 */

export type RrnCheck =
  | { ok: true; kind: 'resident' | 'foreigner'; birth: string }
  | { ok: false; reason: 'format' | 'gender_digit' | 'birth_date' }

/** 성별 자리 → 출생 세기. 9·0은 1800년대 */
const CENTURY: Record<string, number> = { '1': 1900, '2': 1900, '5': 1900, '6': 1900, '3': 2000, '4': 2000, '7': 2000, '8': 2000, '9': 1800, '0': 1800 }

export function normalizeDigits(v: string): string {
  return v.replace(/[^0-9]/g, '')
}

export function checkRrn(raw: string, today: Date = new Date()): RrnCheck {
  const v = normalizeDigits(raw)
  if (!/^\d{13}$/.test(v)) return { ok: false, reason: 'format' }
  const g = v[6]
  const century = CENTURY[g]
  if (century === undefined) return { ok: false, reason: 'gender_digit' }
  const y = century + Number(v.slice(0, 2))
  const m = Number(v.slice(2, 4))
  const d = Number(v.slice(4, 6))
  const date = new Date(Date.UTC(y, m - 1, d))
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d || date > today) {
    return { ok: false, reason: 'birth_date' }
  }
  const birth = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return { ok: true, kind: '5678'.includes(g) ? 'foreigner' : 'resident', birth }
}

/** 사업자등록번호(고유번호 포함) 10자리 검증 */
export function checkBizNo(raw: string): boolean {
  const v = normalizeDigits(raw)
  if (!/^\d{10}$/.test(v)) return false
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5]
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(v[i]) * w[i]
  sum += Math.floor((Number(v[8]) * 5) / 10)
  return (10 - (sum % 10)) % 10 === Number(v[9])
}

/** 화면·영수증 표기용 마스킹: 900101-1****** */
export function maskRrn(raw: string): string {
  const v = normalizeDigits(raw)
  return v.length === 13 ? `${v.slice(0, 6)}-${v[6]}******` : '******-*******'
}

export type OrgReceiptFields = {
  name?: string | null
  business_no?: string | null
  address?: string | null
  representative_name?: string | null
  donee_type?: string | null
  donee_legal_basis?: string | null
  donee_code?: string | null
  donation_type_code?: string | null
}

/** 소득세법 시행규칙 별지 제45호서식 기부금 코드 */
export const DONATION_TYPE_CODES: Record<string, string> = {
  '10': '특례기부금',
  '20': '정치자금기부금',
  '40': '일반기부금(종교단체 외)',
  '41': '일반기부금(종교단체)',
  '42': '우리사주조합기부금',
  '43': '고향사랑기부금',
}

export type FieldIssue = { field: string; message: string; blocking: boolean }

/**
 * 영수증 발급 전 기관(기부금 단체) 기재사항 점검.
 * blocking: 법정 서식 필수 — 없으면 발급하지 않는다 / 그 밖은 경고.
 */
export function checkOrgForReceipt(org: OrgReceiptFields): FieldIssue[] {
  const issues: FieldIssue[] = []
  if (!org.name?.trim()) issues.push({ field: 'name', message: '단체명이 없습니다.', blocking: true })
  if (!org.business_no || !checkBizNo(org.business_no))
    issues.push({ field: 'business_no', message: '사업자등록번호(고유번호)가 없거나 형식·검증번호가 맞지 않습니다.', blocking: true })
  if (!org.address?.trim()) issues.push({ field: 'address', message: '소재지(주소)가 없습니다.', blocking: true })
  if (!org.representative_name?.trim()) issues.push({ field: 'representative_name', message: '대표자 성명이 없습니다.', blocking: true })
  if (!org.donee_legal_basis?.trim())
    issues.push({ field: 'donee_legal_basis', message: '기부금 단체 지정 근거 법령이 없습니다(영수증 기재 권장).', blocking: false })
  if (!org.donation_type_code || !(org.donation_type_code in DONATION_TYPE_CODES))
    issues.push({ field: 'donation_type_code', message: '기부금 유형 코드(10 특례 / 40 일반 / 41 종교단체 등)가 없습니다.', blocking: true })
  if (org.donee_code && !/^[A-Z]{3}$/.test(org.donee_code))
    issues.push({ field: 'donee_code', message: '국세청 기부금단체코드는 알파벳 대문자 3자리입니다.', blocking: true })
  return issues
}
