import { registerVariants } from './index'
import * as S from './faq-schemas'

registerVariants('faq', [
  { id: 'faq-accordion', type: 'faq', label: '아코디언',
    description: '단일 컬럼 아코디언. 가장 일반적.',
    preview: '/landing-variants/faq-accordion.svg', visualWeight: 'minimal',
    dataSchema: S.FaqAccordion, defaultData: S.faqAccordionDefault },
  { id: 'faq-two-column', type: 'faq', label: '2컬럼',
    description: '좌우 분할 2컬럼 아코디언. 공간 효율.',
    preview: '/landing-variants/faq-two-column.svg', visualWeight: 'minimal',
    dataSchema: S.FaqTwoColumn, defaultData: S.faqTwoColumnDefault },
  { id: 'faq-categorized', type: 'faq', label: '카테고리 탭',
    description: '상단 카테고리 필터 + 아코디언.',
    preview: '/landing-variants/faq-categorized.svg', visualWeight: 'bold',
    dataSchema: S.FaqCategorized, defaultData: S.faqCategorizedDefault },
  { id: 'faq-search', type: 'faq', label: '검색형',
    description: '실시간 검색 + 필터링 아코디언.',
    preview: '/landing-variants/faq-search.svg', visualWeight: 'cinematic',
    dataSchema: S.FaqSearch, defaultData: S.faqSearchDefault },
])
