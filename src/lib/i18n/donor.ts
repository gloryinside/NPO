import { cookies } from "next/headers";
import {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
  type DonorLocale,
} from "./donor-client";

/**
 * G-D44: 후원자 포털 경량 i18n 계층 (서버 전용 함수).
 *
 * 전면 라우팅 국제화(e.g. /en/donor) 대신, locale 쿠키 + 작은 메시지 사전을
 * 쓰는 방식. 한국어가 기본이고 ko/en 두 언어만 현재 지원.
 *
 * 사용:
 *   const t = await getT()
 *   t("donor.login.title")
 *
 * 키가 없으면 원본 키 반환 (fallback 안전).
 *
 * 클라이언트에서 쓰는 상수/헬퍼는 `donor-client.ts`에서 직접 import.
 */

export {
  DONOR_LOCALES,
  DEFAULT_LOCALE,
  LOCALE_COOKIE_NAME,
  isValidLocale,
  readDonorLocaleFromDocument,
};
export type { DonorLocale };

const MESSAGES: Record<DonorLocale, Record<string, string>> = {
  ko: {
    "donor.nav.home": "홈",
    "donor.nav.promises": "약정",
    "donor.nav.payments": "납입",
    "donor.nav.receipts": "영수증",
    "donor.nav.impact": "임팩트",
    "donor.nav.cheer": "응원",
    "donor.nav.invite": "초대",
    "donor.nav.settings": "설정",
    "donor.fab.new_donation": "새 후원",
    "donor.offline.message": "오프라인 상태입니다. 일부 기능이 제한됩니다.",
    "donor.error.title": "일시적인 문제가 발생했습니다",
    "donor.error.retry": "다시 시도",
    "donor.empty.generic": "표시할 항목이 없습니다.",
    "donor.login.title": "후원자 로그인",
    "donor.signup.title": "후원자 회원가입",
    "donor.logout": "로그아웃",
    "donor.footer.privacy": "개인정보처리방침",
    "donor.footer.terms": "이용약관",
    "donor.footer.contact": "문의하기",
    "donor.session.expired.title": "세션이 만료되었습니다",
    "donor.session.expired.body": "30분 이상 활동이 없어 자동 로그아웃되었습니다.",

    // SP-1 HeroSection
    "donor.dashboard.greeting.morning": "좋은 아침이에요",
    "donor.dashboard.greeting.afternoon": "안녕하세요",
    "donor.dashboard.greeting.evening": "좋은 저녁이에요",
    "donor.dashboard.hero.subtitle": "지금까지의 후원이 세상을 바꾸고 있습니다.",
    "donor.dashboard.hero.honorific": "님",
    "donor.dashboard.stats.total_donated": "누적 후원액",
    "donor.dashboard.stats.active_pledges": "활성 약정",
    "donor.dashboard.stats.active_unit": "건",
    "donor.dashboard.stats.upcoming": "이번 달 예정",
    "donor.dashboard.stats.upcoming_none": "없음",
    "donor.dashboard.stats.streak": "연속 후원",
    "donor.dashboard.stats.streak_suffix": "개월",
    "donor.dashboard.stats.next_payment": "다음 결제",

    // 대시보드 섹션 헤더/액션
    "donor.dashboard.error.load": "대시보드를 불러오는 중 오류가 발생했습니다. 잠시 후 새로고침해 주세요.",
    "donor.dashboard.section.active_promises": "활성 약정",
    "donor.dashboard.section.recent_payments": "최근 납입 내역",
    "donor.dashboard.section.receipts": "기부금 영수증",
    "donor.dashboard.section.profile": "내 정보",
    "donor.dashboard.section.view_all": "전체 보기",
    "donor.dashboard.onboarding.title": "첫 후원을 시작해보세요",
    "donor.dashboard.onboarding.body": "작은 정기후원부터 변화가 시작됩니다.",
    "donor.dashboard.onboarding.cta": "캠페인 둘러보기",
    "donor.dashboard.card_expiry.title": "결제 카드 만료 임박",
    "donor.dashboard.card_expiry.default_title": "정기후원",
    "donor.dashboard.card_expiry.expired": "이미 만료",
    "donor.dashboard.card_expiry.cta": "카드 업데이트하기",
    "donor.dashboard.empty.payments": "납입 내역이 없습니다.",
    "donor.dashboard.receipt.year_prefix": "",
    "donor.dashboard.receipt.year_suffix": "년 기부금 영수증",
    "donor.dashboard.section.my_info": "내 정보",

    // 공통
    "common.default_campaign": "정기후원",
    "common.general_donation": "일반 후원",
    "common.monthly": "매월",
    "common.day": "일",
    "common.pdf_download": "PDF 다운로드",
    "common.preparing": "준비 중",
  },
  en: {
    "donor.nav.home": "Home",
    "donor.nav.promises": "Pledges",
    "donor.nav.payments": "Payments",
    "donor.nav.receipts": "Receipts",
    "donor.nav.impact": "Impact",
    "donor.nav.cheer": "Cheer",
    "donor.nav.invite": "Invite",
    "donor.nav.settings": "Settings",
    "donor.fab.new_donation": "Donate",
    "donor.offline.message": "You're offline. Some features are unavailable.",
    "donor.error.title": "Something went wrong",
    "donor.error.retry": "Retry",
    "donor.empty.generic": "No items to display.",
    "donor.login.title": "Donor Sign in",
    "donor.signup.title": "Create donor account",
    "donor.logout": "Sign out",
    "donor.footer.privacy": "Privacy Policy",
    "donor.footer.terms": "Terms of Service",
    "donor.footer.contact": "Contact",
    "donor.session.expired.title": "Session expired",
    "donor.session.expired.body":
      "You were logged out due to 30 minutes of inactivity.",

    // SP-1 HeroSection
    "donor.dashboard.greeting.morning": "Good morning",
    "donor.dashboard.greeting.afternoon": "Hello",
    "donor.dashboard.greeting.evening": "Good evening",
    "donor.dashboard.hero.subtitle": "Your support is changing the world.",
    "donor.dashboard.hero.honorific": "",
    "donor.dashboard.stats.total_donated": "Total donated",
    "donor.dashboard.stats.active_pledges": "Active pledges",
    "donor.dashboard.stats.active_unit": "",
    "donor.dashboard.stats.upcoming": "Upcoming this month",
    "donor.dashboard.stats.upcoming_none": "None",
    "donor.dashboard.stats.streak": "Giving streak",
    "donor.dashboard.stats.streak_suffix": " months",
    "donor.dashboard.stats.next_payment": "Next payment",

    // Dashboard section headers/actions
    "donor.dashboard.error.load":
      "Something went wrong loading your dashboard. Please refresh in a moment.",
    "donor.dashboard.section.active_promises": "Active pledges",
    "donor.dashboard.section.recent_payments": "Recent payments",
    "donor.dashboard.section.receipts": "Donation receipts",
    "donor.dashboard.section.profile": "My profile",
    "donor.dashboard.section.view_all": "View all",
    "donor.dashboard.onboarding.title": "Make your first donation",
    "donor.dashboard.onboarding.body": "Small regular giving creates big change.",
    "donor.dashboard.onboarding.cta": "Browse campaigns",
    "donor.dashboard.card_expiry.title": "Card expiring soon",
    "donor.dashboard.card_expiry.default_title": "Recurring donation",
    "donor.dashboard.card_expiry.expired": "Already expired",
    "donor.dashboard.card_expiry.cta": "Update card",
    "donor.dashboard.empty.payments": "No payment history.",
    "donor.dashboard.receipt.year_prefix": "Donation receipt for ",
    "donor.dashboard.receipt.year_suffix": "",
    "donor.dashboard.section.my_info": "My profile",

    // Common
    "common.default_campaign": "Recurring donation",
    "common.general_donation": "General donation",
    "common.monthly": "every",
    "common.day": "",
    "common.pdf_download": "Download PDF",
    "common.preparing": "Preparing",
  },
};

export async function getDonorLocale(): Promise<DonorLocale> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE;
}

/** 서버 컴포넌트에서 t 함수 획득 */
export async function getT(): Promise<(key: string) => string> {
  const locale = await getDonorLocale();
  const table = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  return (key: string) =>
    table[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key;
}
