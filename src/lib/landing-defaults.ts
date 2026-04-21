/**
 * 기관 랜딩페이지 섹션 기본값
 * 섹션 추가 시 이 값으로 초기화된다.
 */
import { nanoid } from 'nanoid'
import type {
  LandingSection,
  LandingSectionType,
  LandingPageContent,
} from '@/types/landing'

export function getDefaultSectionData(type: LandingSectionType): LandingSection['data'] {
  switch (type) {
    case 'hero':
      return {
        bgType: 'color',
        bgValue: '#1a3a5c',
        headline: '함께 만드는 따뜻한 세상',
        subheadline: '여러분의 후원이 변화를 만듭니다.',
        ctaText: '지금 후원하기',
        ctaUrl: '#campaigns',
        overlayOpacity: 40,
        textAlign: 'center',
      }
    case 'stats':
      return {
        title: '우리가 만든 변화',
        items: [
          { icon: '👥', value: '1,200+', label: '누적 후원자' },
          { icon: '💰', value: '₩3.2억', label: '누적 모금액' },
          { icon: '📋', value: '24개', label: '진행 캠페인' },
          { icon: '🌱', value: '5년', label: '활동 기간' },
        ],
      }
    case 'impact':
      return {
        title: '우리의 임팩트',
        blocks: [
          {
            imageUrl: '',
            headline: '지역 아동 교육 지원',
            body: '2023년, 저소득 가정 아동 350명에게 교육 기회를 제공했습니다. 여러분의 후원 덕분에 아이들이 꿈을 키워나가고 있습니다.',
            imagePosition: 'left',
          },
        ],
      }
    case 'campaigns':
      return {
        title: '진행 중인 캠페인',
        subtitle: '지금 참여할 수 있는 캠페인을 확인하세요.',
        showProgress: true,
        maxCount: 3,
      }
    case 'donation-tiers':
      return {
        title: '후원 등급 안내',
        subtitle: '소중한 후원에 감사드립니다.',
        tiers: [
          { amount: 10000,  icon: '🌱', label: '새싹 후원자',  description: '매월 1만원으로 아이들의 교육을 응원합니다.' },
          { amount: 30000,  icon: '🌿', label: '나무 후원자',  description: '매월 3만원으로 더 많은 가정을 지원합니다.' },
          { amount: 100000, icon: '🌳', label: '숲 후원자',    description: '매월 10만원으로 지역사회 변화를 이끕니다.' },
        ],
      }
    case 'team':
      return {
        title: '함께하는 사람들',
        members: [
          { name: '홍길동', role: '대표이사', bio: '20년간 사회복지 분야에 헌신해왔습니다.' },
          { name: '김지원', role: '사무국장', bio: '비영리 운영 전문가로 기관을 이끌고 있습니다.' },
        ],
      }
    case 'cta':
      return {
        headline: '지금 바로 후원에 동참하세요',
        body: '작은 후원이 큰 변화를 만듭니다. 여러분의 참여를 기다립니다.',
        buttonText: '후원하기',
        buttonUrl: '#campaigns',
        bgColor: '#1a3a5c',
      }
    case 'richtext':
      return {
        title: '',
        content: '<p>내용을 입력하세요.</p>',
      }
    case 'testimonials':
      return {
        title: '후원자 후기',
        items: [
          { name: '김○○', role: '정기 후원자', quote: '작은 도움이 모여 큰 변화가 된다는 걸 직접 봤습니다.' },
          { name: '이○○', role: '일시 후원자', quote: '투명한 활동 보고가 신뢰를 주었습니다.' },
        ],
      }
    case 'logos':
      return {
        title: '함께하는 파트너',
        logos: [
          { name: 'Partner 1', imageUrl: 'https://placehold.co/200x80?text=Partner+1' },
          { name: 'Partner 2', imageUrl: 'https://placehold.co/200x80?text=Partner+2' },
          { name: 'Partner 3', imageUrl: 'https://placehold.co/200x80?text=Partner+3' },
          { name: 'Partner 4', imageUrl: 'https://placehold.co/200x80?text=Partner+4' },
        ],
      }
    case 'faq':
      return {
        title: '자주 묻는 질문',
        items: [
          { q: '기부금 영수증은 언제 받을 수 있나요?', a: '연말 국세청 간소화 서비스로 자동 제공됩니다.' },
          { q: '정기 후원 해지는 어떻게 하나요?', a: '마이페이지에서 언제든 해지 가능합니다.' },
        ],
      }
    case 'timeline':
      return {
        title: '우리의 발자취',
        events: [
          { year: '2020', title: '기관 설립', body: '비영리 단체로 출범했습니다.' },
          { year: '2022', title: '누적 1억 모금', body: '후원자 500명이 함께했습니다.' },
          { year: '2024', title: '해외 사업 확장', body: '동남아 3개국으로 활동 영역을 넓혔습니다.' },
        ],
      }
    case 'gallery':
      return {
        title: '활동 현장',
        images: [
          { url: 'https://picsum.photos/seed/g-a/800/600', alt: '활동 현장 1' },
          { url: 'https://picsum.photos/seed/g-b/800/600', alt: '활동 현장 2' },
          { url: 'https://picsum.photos/seed/g-c/800/600', alt: '활동 현장 3' },
          { url: 'https://picsum.photos/seed/g-d/800/600', alt: '활동 현장 4' },
        ],
      }
    case 'financials':
      return {
        title: '재무 투명성',
        year: new Date().getFullYear() - 1,
        totalRaised: 320_000_000,
        totalUsed: 280_000_000,
        balance: 40_000_000,
      }
  }
}

const DEFAULT_VARIANT_SUFFIX: Record<LandingSectionType, string> = {
  hero: 'minimal',
  stats: 'grid',
  impact: 'alternating',
  campaigns: 'grid',
  'donation-tiers': 'cards',
  team: 'grid',
  cta: 'banner',
  richtext: 'plain',
  testimonials: 'cards',
  logos: 'grid',
  faq: 'accordion',
  timeline: 'vertical',
  gallery: 'grid',
  financials: 'summary',
}

export function createSection(type: LandingSectionType, sortOrder: number): LandingSection {
  return {
    id: nanoid(),
    type,
    variant: `${type === 'donation-tiers' ? 'tiers' : type}-${DEFAULT_VARIANT_SUFFIX[type]}`,
    sortOrder,
    isVisible: true,
    data: getDefaultSectionData(type),
  }
}

export const EMPTY_PAGE_CONTENT: LandingPageContent = {
  schemaVersion: 1,
  sections: [],
}
