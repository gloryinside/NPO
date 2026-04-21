import { z } from 'zod'

const Tier = z.object({
  amount: z.number().min(0),
  icon: z.string().max(4).optional(),
  label: z.string().min(1).max(40),
  description: z.string().max(300),
  benefits: z.array(z.string().max(80)).max(10).optional(),
  /** 이 등급으로 바로 후원하는 CTA 링크. 비어 있으면 섹션 기본 (#campaigns) */
  url: z.string().max(500).optional(),
})

export const TiersBase = z.object({
  title: z.string().max(100).optional(),
  subtitle: z.string().max(300).optional(),
  tiers: z.array(Tier).min(1).max(6),
})

export const TiersCards = TiersBase
export const TiersComparison = TiersBase
export const TiersRecommended = TiersBase.extend({
  recommendedIndex: z.number().int().min(0).max(5).optional().default(1),
})
export const TiersHorizontal = TiersBase
export const TiersPricingTable = TiersBase.extend({
  recommendedIndex: z.number().int().min(0).max(5).optional().default(1),
})

export type TiersBaseData = z.infer<typeof TiersBase>
export type TiersRecommendedData = z.infer<typeof TiersRecommended>
export type TiersPricingTableData = z.infer<typeof TiersPricingTable>

const baseTiers = () => ([
  { amount: 10000, icon: '🌱', label: '새싹 후원자', description: '매월 1만원으로 아이들의 교육을 응원합니다.',
    benefits: ['월간 활동 리포트', '후원자 소식지'] },
  { amount: 30000, icon: '🌿', label: '나무 후원자', description: '매월 3만원으로 더 많은 가정을 지원합니다.',
    benefits: ['월간 활동 리포트', '후원자 소식지', '연말 감사장', '기관 행사 초대'] },
  { amount: 100000, icon: '🌳', label: '숲 후원자', description: '매월 10만원으로 지역사회 변화를 이끕니다.',
    benefits: ['월간 활동 리포트', '후원자 소식지', '연말 감사장', '기관 행사 초대', '현장 방문', '연례 리포트'] },
])

export const tiersCardsDefault = (): TiersBaseData => ({
  title: '후원 등급 안내',
  subtitle: '소중한 후원에 감사드립니다.',
  tiers: baseTiers(),
})
export const tiersComparisonDefault = (): TiersBaseData => ({
  title: '등급별 혜택 비교',
  tiers: baseTiers(),
})
export const tiersRecommendedDefault = (): TiersRecommendedData => ({
  title: '가장 많이 선택하신 등급',
  subtitle: '중앙 등급이 가장 많은 후원자의 선택을 받았습니다.',
  tiers: baseTiers(),
  recommendedIndex: 1,
})
export const tiersHorizontalDefault = (): TiersBaseData => ({
  title: '후원 등급',
  tiers: baseTiers(),
})
export const tiersPricingTableDefault = (): TiersPricingTableData => ({
  title: '후원 플랜',
  subtitle: '원하시는 플랜을 선택하세요.',
  tiers: baseTiers(),
  recommendedIndex: 1,
})
