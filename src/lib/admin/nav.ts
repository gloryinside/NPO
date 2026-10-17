/**
 * 관리자 메뉴 정보 구조 — 사이드바·메뉴 검색(⌘K)·즐겨찾기가 함께 쓴다.
 *
 * 예전: 12개 그룹 · 63개 메뉴가 전부 펼쳐져 한 화면에 나열됐다.
 * 지금: 하는 일 기준 6개 허브. 사이드바는 지금 있는 허브만 펼치고, 나머지는 검색·즐겨찾기로 찾는다.
 * 허브 안에서는 자주 쓰는 메뉴(primary)를 위에, 나머지는 "더 보기"로 접는다.
 */

export type AdminNavItem = {
  label: string
  href: string
  /** 이 화면에서 하는 일(한 줄) — 메뉴에 마우스를 올리거나 검색 결과에서 보인다 */
  desc: string
  /** 메뉴 검색에서 같이 찾을 다른 이름(동의어·영문) */
  keywords?: string[]
  /** 허브를 펼쳤을 때 바로 보이는 메뉴. 아니면 "더 보기" 안 */
  primary?: boolean
}

export type AdminNavHub = {
  id: string
  label: string
  /** lucide-react 아이콘 이름 — 사이드바에서 매핑 */
  icon: 'home' | 'users' | 'wallet' | 'megaphone' | 'chart' | 'settings'
  items: AdminNavItem[]
}

export const ADMIN_NAV: AdminNavHub[] = [
  {
    id: 'home',
    label: '홈',
    icon: 'home',
    items: [
      { label: '대시보드', href: '/admin', desc: '오늘 처리할 일과 이번 달 모금 현황', primary: true, keywords: ['dashboard', '요약'] },
      { label: '알림', href: '/admin/notifications', desc: '결제 실패·문의 등 확인이 필요한 알림', primary: true, keywords: ['notification'] },
    ],
  },
  {
    id: 'donors',
    label: '후원자',
    icon: 'users',
    items: [
      { label: '후원자 관리', href: '/admin/members', desc: '후원자 명단 보기·등록·엑셀로 가져오기', primary: true, keywords: ['후원자 등록하기', '엑셀로 후원자 올리기', '회원', 'member', '기부자'] },
      { label: '문의 관리', href: '/admin/inquiries', desc: '후원자가 남긴 문의에 답하기', primary: true, keywords: ['1:1', '고객'] },
      { label: '중복 후원자 합치기', href: '/admin/members/duplicates', desc: '같은 사람이 두 번 등록된 경우 하나로 합치기', keywords: ['병합', 'merge'] },
      { label: '후원자 명단(조건)', href: '/admin/segments', desc: '미납 2회 이상·1년 이상 후원자처럼 조건을 저장해 두고 다시 보기', keywords: ['세그먼트', '조건 검색', '명단 추출', '휴면', '미납자'] },
      { label: '후원자 분류(태그)', href: '/admin/member-tags', desc: '후원자를 묶음으로 나눠 관리', keywords: ['tag', '분류'] },
      { label: '잠재 후원자·봉사자', href: '/admin/crm', desc: '아직 후원 전인 관심 고객과 봉사자 명단', keywords: ['리드', 'lead'] },
      { label: '자원봉사 활동', href: '/admin/volunteer-activities', desc: '봉사 일정과 참여 기록', keywords: ['봉사'] },
      { label: '수혜자 관리', href: '/admin/beneficiaries', desc: '도움을 받는 아동·가정 등의 정보', keywords: ['아동', '결연'] },
      { label: '결연 매칭', href: '/admin/sponsorships', desc: '후원자와 수혜자를 1:1로 연결', keywords: ['sponsorship'] },
      { label: '결연 편지 처리', href: '/admin/sponsor-letters', desc: '후원자·수혜자가 주고받는 편지와 번역', keywords: ['결연 편지'] },
      { label: '기업 매칭 프로그램', href: '/admin/matching-programs', desc: '직원 기부만큼 회사가 더 기부하는 제도', keywords: ['matching gift', '기업'] },
      { label: '기업 매칭 신청', href: '/admin/matching-requests', desc: '후원자가 낸 회사 매칭 신청 처리' },
    ],
  },
  {
    id: 'giving',
    label: '후원·결제',
    icon: 'wallet',
    items: [
      { label: '정기후원 관리', href: '/admin/promises', desc: '매달 자동결제되는 후원 약속(약정) 목록', primary: true, keywords: ['정기후원', 'promise'] },
      { label: '결제 내역', href: '/admin/payments', desc: '들어온 후원금 한 건 한 건의 기록', primary: true, keywords: ['결제', 'payment'] },
      { label: '결제 실패·미납', href: '/admin/unpaid', desc: '카드 한도·잔액 부족 등으로 결제가 안 된 후원', primary: true, keywords: ['결제 안 된 후원 확인', '재결제', '실패', '재청구'] },
      { label: '기부금영수증', href: '/admin/receipts', desc: '연말정산용 영수증 발급과 국세청 제출 자료', primary: true, keywords: ['영수증 발급하기', '연말정산 자료 만들기', '국세청 제출', '영수증', '국세청', '연말정산', '간소화'] },
      { label: '결제 예정일', href: '/admin/schedules', desc: '앞으로 자동결제될 날짜와 금액', keywords: ['결제일'] },
      { label: '정기후원 금액 변경', href: '/admin/promises/changes', desc: '후원자가 금액을 올리거나 줄인 기록', keywords: ['증액', '감액'] },
      { label: '자동이체(CMS) 청구', href: '/admin/cms-claims', desc: '이번에 출금할 명단을 CMS 프로그램용으로 내려받고 결과 반영하기', keywords: ['자동이체 출금하기', '출금 명단 만들기', 'CMS', '효성', '청구'] },
      { label: '자동이체(CMS) 실패', href: '/admin/cms-errors', desc: '은행 자동이체 출금이 안 된 건', keywords: ['자동이체', 'EFT'] },
      { label: '카드 결제 이의 제기', href: '/admin/chargebacks', desc: '후원자가 카드사에 결제 취소를 요청한 건', keywords: ['이의 제기 등록하기', '차지백', 'dispute'] },
      { label: '환불 요청 승인', href: '/admin/refund-approvals', desc: '환불 요청을 확인하고 승인하기', keywords: ['환불하기', '취소', 'refund'] },
      { label: '통장 입금 확인', href: '/admin/bank-reconciliation', desc: '통장에 들어온 돈과 후원 기록 맞춰 보기', keywords: ['무통장', '계좌이체'] },
      { label: '회비', href: '/admin/membership-fees', desc: '협회·조합 회원의 회비 종류, 납부 기록, 미납 명단', keywords: ['연회비', '월회비', '회원비', '미납 회비'] },
      { label: '물품기부', href: '/admin/in-kind', desc: '돈이 아닌 물품으로 받은 기부 기록', keywords: ['현물'] },
    ],
  },
  {
    id: 'outreach',
    label: '모금·소통',
    icon: 'megaphone',
    items: [
      { label: '캠페인', href: '/admin/campaigns', desc: '모금 캠페인 만들기·수정·마감', primary: true, keywords: ['캠페인 만들기', '모금 시작하기', 'campaign', '모금'] },
      { label: '홈페이지 편집', href: '/admin/landing', desc: '기관 후원 홈페이지 꾸미기', primary: true, keywords: ['홈페이지 꾸미기', '홈페이지', '빌더', 'landing'] },
      { label: '문자·이메일 보내기', href: '/admin/communications', desc: '후원자에게 직접 안내 보내기', primary: true, keywords: ['문자', '이메일', 'SMS'] },
      { label: '응원 메시지 관리', href: '/admin/cheer', desc: '캠페인에 달린 응원 글 공개·숨김', keywords: ['댓글', '검수'] },
      { label: '공지·자주 묻는 질문', href: '/admin/board', desc: '후원자 화면에 보이는 공지와 FAQ', keywords: ['공지사항', 'FAQ'] },
      { label: '후원자 여정 메시지', href: '/admin/journeys', desc: '시작 다음 날·한 달 감사·기념일·생일에 자동으로 나가는 안내', keywords: ['자동 메시지', '환영', '생일', '1주년', '마케팅 자동화'] },
      { label: '이메일 문구', href: '/admin/email-templates', desc: '자동으로 나가는 이메일의 내용', keywords: ['메일 양식'] },
      { label: '반송된 이메일', href: '/admin/email-bounces', desc: '주소 오류로 전달되지 않은 이메일', keywords: ['bounce'] },
      { label: '신청 화면 A/B 비교', href: '/admin/ab-tests', desc: '금액 버튼·먼저 보이는 후원 유형을 두 안으로 나눠 어느 쪽이 더 많이 신청받는지 비교', keywords: ['A/B 테스트', '전환율', '실험', '금액 버튼'] },
      { label: '현장 모금(태블릿)', href: '/admin/f2f', desc: '거리·행사장에서 태블릿으로 정기후원 신청 받는 링크와 모금가별 실적', keywords: ['거리 모금', '대면 모금', 'F2F', '모금가', '태블릿'] },
      { label: '외부 모금 채널', href: '/admin/donation-channels', desc: '해피빈 등 다른 곳에서 받은 모금', keywords: ['채널'] },
      { label: '채널별 모금 통계', href: '/admin/channel-stats', desc: '어디서 얼마나 모였는지' },
      { label: '사업/프로그램', href: '/admin/programs', desc: '모금액이 쓰이는 사업', keywords: ['사업'] },
      { label: '행사', href: '/admin/events', desc: '후원 행사와 참석자', keywords: ['event'] },
      { label: '감사 선물 발송', href: '/admin/gift-shipments', desc: '후원자에게 보내는 기념품 발송 목록', keywords: ['답례품'] },
      { label: '감사 선물 기준', href: '/admin/gift-rules', desc: '어떤 후원자에게 어떤 선물을 보낼지' },
    ],
  },
  {
    id: 'finance',
    label: '회계·분석',
    icon: 'chart',
    items: [
      { label: '기부금 활용실적 명세서', href: '/admin/disclosures/nts-63-7', desc: '국세청 서식(별지 제63호의7)으로 연간 모금액·활용실적 공개 자료 만들기', keywords: ['공시', '국세청 서식', '활용실적', '결산 공개', '63호의7'] },
      { label: '모금 통계', href: '/admin/stats', desc: '기간별 모금액과 후원자 수', primary: true, keywords: ['리포트', 'report'] },
      { label: '입금 내역 ERP 반영', href: '/admin/erp/reconcile', desc: '확인된 후원금을 회계(ERP) 전표로 보내기', primary: true, keywords: ['회계로 보내기', '전표 만들기', 'ERP', '전표'] },
      { label: '결산 보고서', href: '/admin/fiscal-reports', desc: '연간 수입·지출 결산과 공시 자료', primary: true, keywords: ['결산', '공시'] },
      { label: '데이터 점검', href: '/admin/reports/data-health', desc: '연락처 누락 등 고칠 데이터 찾기' },
      { label: '유입 경로 분석', href: '/admin/utm-stats', desc: '어떤 광고·링크로 후원이 들어왔는지', keywords: ['유입'] },
      { label: '수입 전표', href: '/admin/revenue-journals', desc: '후원금 수입 회계 기록', keywords: ['ERP'] },
      { label: '계정과목', href: '/admin/chart-of-accounts', desc: '회계 분류 항목(예: 지정기부금 수입)', keywords: ['ERP'] },
      { label: '은행 계좌', href: '/admin/bank-accounts', desc: '후원금을 받는 기관 계좌' },
      { label: '가상계좌 연결', href: '/admin/virtual-account-mappings', desc: '후원자별 가상계좌와 후원 연결' },
      { label: '회계 마감', href: '/admin/closed-periods', desc: '마감한 달은 기록을 고칠 수 없게 잠금' },
      { label: '세금계산서 발행 목록', href: '/admin/tax-invoices', desc: '기업 후원자에게 발행할 세금계산서' },
      { label: '지출 결의', href: '/admin/expense-vouchers', desc: '사업비 지출 요청과 승인' },
      { label: '정산 금액 차이 확인', href: '/admin/settlement-discrepancies', desc: '결제사 정산액과 기록이 다른 건' },
    ],
  },
  {
    id: 'settings',
    label: '설정',
    icon: 'settings',
    items: [
      { label: '기관 설정', href: '/admin/settings', desc: '기관 정보·영수증 기재사항·결제 연결', primary: true, keywords: ['대표자 입력', '사업자번호 입력', '토스 연결', '대표자', '사업자번호', '테마'] },
      { label: '관리자 계정', href: '/admin/users', desc: '함께 일할 직원 초대·삭제', primary: true, keywords: ['직원 초대하기', '관리자 초대', '계정'] },
      { label: '2단계 인증', href: '/admin/mfa/setup', desc: '내 관리자 계정에 OTP 앱 등록, 기관 전체 필수 설정', keywords: ['OTP', 'MFA', '보안', '이중 인증', 'OTP 등록하기'] },
      { label: '작업 기록', href: '/admin/audit-logs', desc: '누가 언제 무엇을 바꿨는지', keywords: ['audit', '이력'] },
      { label: '개인정보 보호', href: '/admin/compliance', desc: '개인정보 보관·파기 관리', keywords: ['개인정보'] },
    ],
  },
]

export const ALL_NAV_ITEMS: Array<AdminNavItem & { hubId: string; hubLabel: string }> = ADMIN_NAV.flatMap((h) =>
  h.items.map((it) => ({ ...it, hubId: h.id, hubLabel: h.label })),
)

/** 현재 경로에 해당하는 메뉴 — 하위 경로도 인정하고, 여럿 맞으면 가장 길게 맞는 하나 */
export function activeNavHref(pathname: string): string | null {
  let best: string | null = null
  for (const { href } of ALL_NAV_ITEMS) {
    const hit = href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/')
    if (hit && (!best || href.length > best.length)) best = href
  }
  return best
}

export function hubOfHref(href: string | null): string | null {
  if (!href) return null
  return ALL_NAV_ITEMS.find((it) => it.href === href)?.hubId ?? null
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, '')

/** 메뉴 검색 — 이름 앞부분 일치 > 이름 포함 > 하는 일·동의어 > 허브·설명 포함 순 */
// 문장으로 물어도 찾게 — 낱말마다 조사·어미를 떼어 본다("영수증은" → "영수증", "보내요" → "보내")
const PARTICLES = /(에서|으로|에게|하고|해요|하나요|인가요|은|는|이|가|을|를|에|로|도|만|요|나요|까요)$/
const STOP = new Set(['어떻게', '어디서', '어디', '무엇', '뭐', '하려면', '하고', '싶어요', '방법', '하는', '좀'])

function terms(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean)
  const out = new Set<string>()
  for (const w of words) {
    if (STOP.has(w)) continue
    const base = w.replace(PARTICLES, '')
    if (base.length >= 2) out.add(norm(base))
  }
  return [...out]
}

function scoreFor(item: (typeof ALL_NAV_ITEMS)[number], q: string): number {
  const label = norm(item.label)
  if (label.startsWith(q)) return 3
  if (label.includes(q)) return 2
  if ((item.keywords ?? []).some((k) => norm(k).includes(q))) return 1.5
  if (norm(item.hubLabel).includes(q) || norm(item.desc).includes(q)) return 1
  return 0
}

/** 메뉴 검색 — 이름 앞부분 일치 > 이름 포함 > 하는 일·동의어 > 허브·설명 포함. 문장이면 낱말 점수를 더한다 */
export function searchNav(query: string, limit = 12) {
  const q = norm(query)
  if (!q) return []
  const words = terms(query)
  const scored: Array<{ item: (typeof ALL_NAV_ITEMS)[number]; score: number }> = []
  for (const item of ALL_NAV_ITEMS) {
    let score = scoreFor(item, q) * 2 // 입력 전체가 맞으면 가장 앞
    if (words.length > 1 || score === 0) for (const w of words) score += scoreFor(item, w)
    if (score) scored.push({ item, score })
  }
  return scored
    .sort((a, b) => b.score - a.score || a.item.label.length - b.item.label.length)
    .slice(0, limit)
    .map((s) => s.item)
}
