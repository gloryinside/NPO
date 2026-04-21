import { z } from 'zod'

export const CampaignsBase = z.object({
  title: z.string().max(100).optional(),
  subtitle: z.string().max(300).optional(),
  showProgress: z.boolean().optional().default(true),
  maxCount: z.number().int().min(1).max(12).optional().default(3),
})

export const CampaignsGrid = CampaignsBase
export const CampaignsFeatured = CampaignsBase
export const CampaignsCarousel = CampaignsBase
export const CampaignsList = CampaignsBase
export const CampaignsMasonry = CampaignsBase

export type CampaignsBaseData = z.infer<typeof CampaignsBase>

const baseData = (): CampaignsBaseData => ({
  title: '진행 중인 캠페인',
  subtitle: '지금 참여할 수 있는 캠페인을 확인하세요.',
  showProgress: true,
  maxCount: 3,
})

export const campaignsGridDefault = baseData
export const campaignsFeaturedDefault = (): CampaignsBaseData => ({ ...baseData(), maxCount: 4 })
export const campaignsCarouselDefault = (): CampaignsBaseData => ({ ...baseData(), maxCount: 6 })
export const campaignsListDefault = baseData
export const campaignsMasonryDefault = (): CampaignsBaseData => ({ ...baseData(), maxCount: 6 })
