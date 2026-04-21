/**
 * 기관 랜딩페이지 섹션 빌더 타입 정의
 *
 * RecruitFlow portal-sections 아키텍처를 NPO_S 후원 도메인에 맞게 이식.
 * 섹션은 orgs.page_content JSONB 내 배열로 저장된다.
 */

// ─── 섹션 타입 ────────────────────────────────────────────────────────────────

export type LandingSectionType =
  | 'hero'            // 배경+헤드카피+CTA
  | 'stats'           // 숫자 통계
  | 'impact'          // 임팩트 스토리
  | 'campaigns'       // 진행 중인 캠페인 목록
  | 'donation-tiers'  // 후원 등급 안내
  | 'team'            // 팀/이사회 소개
  | 'cta'             // 후원 유도 배너
  | 'richtext'        // 자유 HTML
  | 'testimonials'    // Phase B: 후원자 후기
  | 'logos'           // Phase B: 파트너/언론 로고
  | 'faq'             // Phase B: 자주 묻는 질문
  | 'timeline'        // Phase C: 기관 연혁/활동
  | 'gallery'         // Phase C: 활동 사진 갤러리

// ─── 섹션별 데이터 타입 ───────────────────────────────────────────────────────

export interface HeroSectionData {
  bgType: 'color' | 'image'
  bgValue: string              // hex color 또는 이미지 URL
  headline: string
  subheadline?: string
  ctaText?: string
  ctaUrl?: string
  overlayOpacity?: number      // 0~100
  textAlign?: 'left' | 'center' | 'right'
}

export interface StatItem {
  icon?: string
  value: string
  label: string
}
export interface StatsSectionData {
  title?: string
  items: StatItem[]
}

export interface ImpactBlock {
  imageUrl?: string
  headline: string
  body: string
  imagePosition?: 'left' | 'right' | 'none'
}
export interface ImpactSectionData {
  title?: string
  blocks: ImpactBlock[]
}

export interface CampaignsSectionData {
  title?: string
  subtitle?: string
  showProgress?: boolean
  maxCount?: number            // 최대 표시 캠페인 수 (기본 3)
}

export interface DonationTier {
  amount: number
  label: string
  description: string
  icon?: string
}
export interface DonationTiersSectionData {
  title?: string
  subtitle?: string
  tiers: DonationTier[]
}

export interface TeamMember {
  name: string
  role: string
  bio?: string
  photoUrl?: string
}
export interface TeamSectionData {
  title?: string
  members: TeamMember[]
}

export interface CtaSectionData {
  headline: string
  body?: string
  buttonText: string
  buttonUrl?: string
  bgColor?: string
}

export interface RichtextSectionData {
  title?: string
  content: string              // HTML string
}

// ─── Phase B~C 신규 섹션 data (variant별 zod 스키마가 truth, 여기는 union 자리 확보만) ───

export interface TestimonialsSectionData {
  title?: string
  items: Array<{ name: string; role?: string; quote: string; photoUrl?: string }>
}

export interface LogosSectionData {
  title?: string
  logos: Array<{ name: string; imageUrl: string; url?: string }>
}

export interface FaqSectionData {
  title?: string
  items: Array<{ q: string; a: string; category?: string }>
}

export interface TimelineSectionData {
  title?: string
  events: Array<{ year: string; title: string; body?: string; imageUrl?: string }>
}

export interface GallerySectionData {
  title?: string
  images: Array<{ url: string; alt: string; caption?: string }>
}

export type LandingSectionData =
  | HeroSectionData
  | StatsSectionData
  | ImpactSectionData
  | CampaignsSectionData
  | DonationTiersSectionData
  | TeamSectionData
  | CtaSectionData
  | RichtextSectionData
  | TestimonialsSectionData
  | LogosSectionData
  | FaqSectionData
  | TimelineSectionData
  | GallerySectionData

// ─── 섹션 레코드 ──────────────────────────────────────────────────────────────

export interface LandingSection {
  id: string
  type: LandingSectionType
  variant: string            // v2 NEW: 'hero-minimal' | 'hero-fullscreen-video' | ...
  sortOrder: number
  isVisible: boolean
  data: LandingSectionData
}

// ─── page_content 루트 구조 ───────────────────────────────────────────────────

export interface LandingPageContent {
  schemaVersion: 1 | 2
  sections: LandingSection[]
}

// ─── SHARED_FIELDS ─ variant 전환 시 보존될 공통 필드 ──────────────────────────

export const SHARED_FIELDS: Record<LandingSectionType, readonly string[]> = {
  hero:             ['headline', 'subheadline', 'ctaText', 'ctaUrl', 'textAlign'],
  stats:            ['title', 'items'],
  impact:           ['title', 'blocks'],
  campaigns:        ['title', 'subtitle', 'maxCount', 'showProgress'],
  'donation-tiers': ['title', 'subtitle', 'tiers'],
  team:             ['title', 'members'],
  cta:              ['headline', 'body', 'buttonText', 'buttonUrl'],
  richtext:         ['title', 'content'],
  testimonials:     ['title', 'items'],
  logos:            ['title', 'logos'],
  faq:              ['title', 'items'],
  timeline:         ['title', 'events'],
  gallery:          ['title', 'images'],
}

// ─── 섹션 카탈로그 (에디터 팔레트용) ──────────────────────────────────────────

export interface SectionCatalogItem {
  type: LandingSectionType
  label: string
  emoji: string
  desc: string
}

export const SECTION_CATALOG: SectionCatalogItem[] = [
  { type: 'hero',           emoji: '🎯', label: '히어로',         desc: '배경 이미지/색상 + 헤드카피 + CTA 버튼' },
  { type: 'stats',          emoji: '📊', label: '통계',            desc: '누적 후원자 수, 모금액 등 숫자 지표' },
  { type: 'impact',         emoji: '💚', label: '임팩트 스토리',   desc: '이미지와 텍스트로 활동 성과를 소개' },
  { type: 'campaigns',      emoji: '📋', label: '캠페인 목록',     desc: '현재 진행 중인 캠페인 자동 표시' },
  { type: 'testimonials',   emoji: '💬', label: '후원자 후기',     desc: '실제 후원자들의 목소리로 신뢰 강화' },
  { type: 'logos',          emoji: '🏢', label: '파트너/언론',     desc: '협력 기관, 언론 보도 로고 띠' },
  { type: 'faq',            emoji: '❓', label: '자주 묻는 질문',  desc: '후원 관련 궁금증을 미리 해소' },
  { type: 'timeline',       emoji: '📅', label: '연혁/타임라인',   desc: '기관의 발자취와 활동 이정표' },
  { type: 'gallery',        emoji: '🖼️', label: '갤러리',          desc: '활동 사진을 다양한 레이아웃으로' },
  { type: 'donation-tiers', emoji: '🏆', label: '후원 등급',       desc: '금액별 후원 등급과 혜택 안내' },
  { type: 'team',           emoji: '👥', label: '팀 소개',         desc: '이사진, 운영진 등 팀원 카드' },
  { type: 'cta',            emoji: '💛', label: 'CTA 배너',        desc: '후원 참여 유도 강조 배너' },
  { type: 'richtext',       emoji: '📝', label: '자유 텍스트',     desc: '직접 HTML을 입력하는 자유 영역' },
]
