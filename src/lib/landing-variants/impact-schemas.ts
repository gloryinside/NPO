import { z } from 'zod'

const ImpactBlock = z.object({
  headline: z.string().min(1).max(100),
  body: z.string().min(1).max(2000),
  imageUrl: z.string().url().optional(),
  imagePosition: z.enum(['left', 'right', 'none']).optional().default('left'),
})

const BeforeAfterBlock = z.object({
  headline: z.string().min(1).max(100),
  body: z.string().max(500).optional(),
  beforeImageUrl: z.string().url(),
  afterImageUrl: z.string().url(),
  beforeLabel: z.string().max(40).optional().default('Before'),
  afterLabel: z.string().max(40).optional().default('After'),
})

export const ImpactAlternating = z.object({
  title: z.string().max(100).optional(),
  blocks: z.array(ImpactBlock).min(1).max(8),
})
export const ImpactZigzag = ImpactAlternating
export const ImpactCards = ImpactAlternating
export const ImpactStorytelling = ImpactAlternating
export const ImpactBeforeAfter = z.object({
  title: z.string().max(100).optional(),
  blocks: z.array(BeforeAfterBlock).min(1).max(6),
})

export type ImpactAlternatingData = z.infer<typeof ImpactAlternating>
export type ImpactZigzagData = z.infer<typeof ImpactZigzag>
export type ImpactCardsData = z.infer<typeof ImpactCards>
export type ImpactStorytellingData = z.infer<typeof ImpactStorytelling>
export type ImpactBeforeAfterData = z.infer<typeof ImpactBeforeAfter>

const baseBlocks = () => ([
  {
    imageUrl: 'https://picsum.photos/seed/imp1/800/600',
    headline: '지역 아동 교육 지원',
    body: '2023년, 저소득 가정 아동 350명에게 교육 기회를 제공했습니다.',
    imagePosition: 'left' as const,
  },
  {
    imageUrl: 'https://picsum.photos/seed/imp2/800/600',
    headline: '해외 긴급 구호',
    body: '자연재해 피해 지역에 생필품과 의료 지원을 보냈습니다.',
    imagePosition: 'right' as const,
  },
])

export const impactAlternatingDefault = (): ImpactAlternatingData => ({
  title: '우리의 임팩트',
  blocks: baseBlocks(),
})
export const impactZigzagDefault = (): ImpactZigzagData => ({
  title: '활동 하이라이트',
  blocks: baseBlocks(),
})
export const impactCardsDefault = (): ImpactCardsData => ({
  title: '주요 사업',
  blocks: [
    ...baseBlocks(),
    {
      imageUrl: 'https://picsum.photos/seed/imp3/800/600',
      headline: '청소년 멘토링',
      body: '500명의 청소년이 진로 멘토와 연결됐습니다.',
      imagePosition: 'none' as const,
    },
  ],
})
export const impactStorytellingDefault = (): ImpactStorytellingData => ({
  title: '변화의 순간들',
  blocks: baseBlocks(),
})
export const impactBeforeAfterDefault = (): ImpactBeforeAfterData => ({
  title: '변화의 증거',
  blocks: [
    {
      headline: '지역 쉼터 리모델링',
      body: '3개월간의 리모델링으로 60명이 더 이용할 수 있게 되었습니다.',
      beforeImageUrl: 'https://picsum.photos/seed/ba1a/800/600',
      afterImageUrl: 'https://picsum.photos/seed/ba1b/800/600',
      beforeLabel: '개보수 전',
      afterLabel: '개보수 후',
    },
  ],
})
