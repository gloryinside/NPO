import { registerVariants } from './index'
import * as S from './tiers-schemas'

registerVariants('donation-tiers', [
  { id: 'tiers-cards', type: 'donation-tiers', label: '카드',
    description: '3열 카드 그리드. 현재 기본 레이아웃.',
    preview: '/landing-variants/tiers-cards.svg', visualWeight: 'minimal',
    dataSchema: S.TiersCards, defaultData: S.tiersCardsDefault },
  { id: 'tiers-comparison', type: 'donation-tiers', label: '혜택 비교표',
    description: '등급별 혜택 체크표. 비교하기 쉬움.',
    preview: '/landing-variants/tiers-comparison.svg', visualWeight: 'bold',
    dataSchema: S.TiersComparison, defaultData: S.tiersComparisonDefault },
  { id: 'tiers-recommended', type: 'donation-tiers', label: '추천 강조',
    description: '중앙 등급을 크게 강조 + 추천 배지.',
    preview: '/landing-variants/tiers-recommended.svg', visualWeight: 'bold',
    dataSchema: S.TiersRecommended, defaultData: S.tiersRecommendedDefault },
  { id: 'tiers-horizontal', type: 'donation-tiers', label: '가로 배치',
    description: '가로 1줄 배치, 금액 강조.',
    preview: '/landing-variants/tiers-horizontal.svg', visualWeight: 'minimal',
    dataSchema: S.TiersHorizontal, defaultData: S.tiersHorizontalDefault },
  { id: 'tiers-pricing-table', type: 'donation-tiers', label: 'SaaS 프라이싱',
    description: 'SaaS 스타일 pricing page + 혜택 체크리스트 + CTA 버튼.',
    preview: '/landing-variants/tiers-pricing-table.svg', visualWeight: 'cinematic',
    dataSchema: S.TiersPricingTable, defaultData: S.tiersPricingTableDefault },
])
