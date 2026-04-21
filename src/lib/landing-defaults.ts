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
