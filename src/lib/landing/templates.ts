/**
 * 랜딩 섹션 템플릿·페이지 묶음 — JobYLW 포털 빌더 templates.ts 방식을 후원 기관용으로.
 * 빈 기본값 대신 후원 페이지에 맞는 문구가 채워진 섹션. 시즌 템플릿은 보이는 기간이 함께 정해져
 * 시즌이 끝나면 공개 화면에서 저절로 내려간다.
 *
 * 원칙: 지어낸 숫자(누적 후원자·모금액·재정 수치)를 넣지 않는다 — 통계·재정 섹션은 템플릿에서 뺐다.
 * 정본 테스트: tests/unit/landing/landing-templates.test.ts (모든 템플릿이 서버 검증·게시 전 점검 통과)
 */
import { nanoid } from 'nanoid'
import type { LandingSection, LandingSectionType } from '@/types/landing'
import { findVariant } from '@/lib/landing-variants'
import '@/lib/landing-variants/register-all'

export type TemplateCategory = '시즌' | '참여 유도' | '안내'
export type SectionTemplate = {
  id: string
  name: string
  description: string
  category: TemplateCategory
  type: LandingSectionType
  variant: string
  /** 변형 기본값 위에 덮어쓸 문구·설정 */
  patch: Record<string, unknown>
}
export type PageBundle = { id: string; name: string; description: string; templateIds: string[] }

export const TEMPLATE_CATEGORIES: TemplateCategory[] = ['시즌', '참여 유도', '안내']

/** today = 한국 날짜 YYYY-MM-DD */
export function sectionTemplates(today: string): SectionTemplate[] {
  const y = Number(today.slice(0, 4))
  const yearEnd = `${y}-12-31`
  return [
    {
      id: 'yearend-cta',
      category: '시즌',
      type: 'cta',
      variant: 'cta-gradient',
      name: `${y} 연말정산 전 기부 안내`,
      description: '12월 31일까지 보여요. 올해 기부분은 올해 연말정산에 반영됩니다.',
      patch: {
        headline: `${y}년 기부, 12월 31일까지 함께해 주세요`,
        body: '올해 기부하신 금액은 기부금영수증으로 연말정산 세액공제를 받을 수 있어요.',
        buttonText: '지금 후원하기',
        buttonUrl: '#campaigns',
        schedule: { from: today, until: yearEnd },
      },
    },
    {
      id: 'monthly-hero',
      category: '참여 유도',
      type: 'hero',
      variant: 'hero-fullscreen-image',
      name: '정기후원 모집 첫 화면',
      description: '기본 그림 위에 정기후원 권유 문구와 버튼',
      patch: {
        headline: '매달의 작은 나눔이 이웃의 내일을 바꿉니다',
        subheadline: '정기후원은 언제든 금액을 바꾸거나 멈출 수 있어요.',
        ctaText: '정기후원 시작하기',
        ctaUrl: '#campaigns',
        bgImageUrl: '/img/landing/hero-monthly.webp',
        overlayOpacity: 60,
      },
    },
    {
      id: 'yearend-hero',
      category: '시즌',
      type: 'hero',
      variant: 'hero-fullscreen-image',
      name: `${y} 연말 모금 첫 화면`,
      description: '겨울 거리 그림 위에 연말 기부 안내. 12월 31일까지 보여요.',
      patch: {
        headline: '올겨울, 이웃의 하루를 따뜻하게',
        subheadline: `${y}년 12월 31일까지 기부하시면 올해 연말정산 세액공제를 받을 수 있어요.`,
        ctaText: '연말 후원하기',
        ctaUrl: '#campaigns',
        bgImageUrl: '/img/landing/hero-yearend.webp',
        overlayOpacity: 55,
        schedule: { from: today, until: yearEnd },
      },
    },
    {
      id: 'monthly-tiers',
      category: '참여 유도',
      type: 'donation-tiers',
      variant: 'tiers-recommended',
      name: '정기후원 금액 선택',
      description: '추천 금액이 강조된 후원 등급 카드',
      patch: { title: '매달 얼마로 함께할까요?', subtitle: '부담 없는 금액으로 시작해 언제든 바꿀 수 있어요.' },
    },
    {
      id: 'donate-cta',
      category: '참여 유도',
      type: 'cta',
      variant: 'cta-banner',
      name: '후원 참여 배너',
      description: '페이지 끝에 두는 짧은 후원 권유',
      patch: {
        headline: '여러분의 후원이 다음 변화를 만듭니다',
        body: '지금 진행 중인 캠페인에 함께해 주세요.',
        buttonText: '후원하기',
        buttonUrl: '#campaigns',
        style: { theme: 'dark', spacing: 'none' },
      },
    },
    {
      id: 'campaigns-list',
      category: '참여 유도',
      type: 'campaigns',
      variant: 'campaigns-grid',
      name: '진행 중인 캠페인',
      description: '진행 중인 캠페인과 모금 현황이 자동으로 채워져요.',
      patch: {},
    },
    {
      id: 'giving-faq',
      category: '안내',
      type: 'faq',
      variant: 'faq-accordion',
      name: '후원·영수증 자주 묻는 질문',
      description: '기부금영수증·연말정산·해지·카드 변경',
      patch: {
        title: '자주 묻는 질문',
        items: [
          {
            q: '기부금영수증은 어떻게 받나요?',
            a: '후원 신청 때 영수증을 신청하시면 매년 1월 지난해 기부분을 모아 한 장으로 발급해 이메일과 마이페이지로 보내 드려요.',
            category: '영수증',
          },
          {
            q: '연말정산 간소화에 자동으로 반영되나요?',
            a: '주민등록번호를 등록하고 수집·이용에 동의하시면 국세청 자료로 제출되어 간소화 서비스에 반영돼요. 등록하지 않으셔도 영수증은 발급됩니다.',
            category: '영수증',
          },
          {
            q: '정기후원 금액 변경이나 해지는 어떻게 하나요?',
            a: '마이페이지 > 약정에서 언제든 금액·결제일 변경, 잠시 멈춤, 해지를 하실 수 있어요. 해지하면 등록된 카드의 자동결제 정보도 바로 삭제돼요.',
            category: '정기후원',
          },
          {
            q: '결제 카드를 바꾸고 싶어요.',
            a: '마이페이지 > 약정 > 결제수단 변경에서 토스페이먼츠 결제창으로 새 카드를 등록하시면 돼요. 카드번호는 기관 서버에 저장되지 않아요.',
            category: '정기후원',
          },
        ],
      },
    },
  ]
}

export const PAGE_BUNDLES: PageBundle[] = [
  { id: 'basic-home', name: '기본 홈', description: '첫 화면 → 캠페인 → 후원 배너', templateIds: ['monthly-hero', 'campaigns-list', 'donate-cta'] },
  {
    id: 'monthly-giving',
    name: '정기후원 모집',
    description: '첫 화면 → 금액 선택 → 자주 묻는 질문 → 후원 배너',
    templateIds: ['monthly-hero', 'monthly-tiers', 'giving-faq', 'donate-cta'],
  },
  {
    id: 'year-end',
    name: '연말 모금',
    description: '겨울 첫 화면 → 캠페인 → 자주 묻는 질문 → 연말 배너 (첫 화면·배너는 12/31까지)',
    templateIds: ['yearend-hero', 'campaigns-list', 'giving-faq', 'yearend-cta'],
  },
]

/** 템플릿 → 새 섹션(변형 기본값 + 템플릿 문구) */
export function sectionFromTemplate(t: SectionTemplate, sortOrder: number): LandingSection {
  const descriptor = findVariant(t.variant)
  const base = (descriptor?.defaultData() ?? {}) as Record<string, unknown>
  return {
    id: nanoid(),
    type: t.type,
    variant: t.variant,
    sortOrder,
    isVisible: true,
    data: { ...base, ...t.patch } as LandingSection['data'],
  }
}

export function sectionsFromBundle(bundleId: string, today: string, startOrder = 0): LandingSection[] {
  const bundle = PAGE_BUNDLES.find((b) => b.id === bundleId)
  if (!bundle) return []
  const byId = new Map(sectionTemplates(today).map((t) => [t.id, t]))
  return bundle.templateIds
    .map((id) => byId.get(id))
    .filter((t): t is SectionTemplate => !!t)
    .map((t, i) => sectionFromTemplate(t, startOrder + i))
}
