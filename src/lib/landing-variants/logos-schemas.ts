import { z } from 'zod'

const Logo = z.object({
  name: z.string().min(1).max(60),
  imageUrl: z.string().url(),
  url: z.string().url().optional(),
})

export const LogosBase = z.object({
  title: z.string().max(100).optional(),
  logos: z.array(Logo).min(2).max(24),
})

export const LogosGrid = LogosBase
export const LogosMarquee = LogosBase
export const LogosPress = LogosBase
export const LogosPartners = LogosBase

export type LogosBaseData = z.infer<typeof LogosBase>

const baseLogos = () => ([
  { name: 'Partner 1', imageUrl: 'https://placehold.co/200x80?text=Partner+1' },
  { name: 'Partner 2', imageUrl: 'https://placehold.co/200x80?text=Partner+2' },
  { name: 'Partner 3', imageUrl: 'https://placehold.co/200x80?text=Partner+3' },
  { name: 'Partner 4', imageUrl: 'https://placehold.co/200x80?text=Partner+4' },
  { name: 'Partner 5', imageUrl: 'https://placehold.co/200x80?text=Partner+5' },
  { name: 'Partner 6', imageUrl: 'https://placehold.co/200x80?text=Partner+6' },
])

export const logosGridDefault = (): LogosBaseData => ({ title: '함께하는 파트너', logos: baseLogos() })
export const logosMarqueeDefault = (): LogosBaseData => ({ title: '', logos: baseLogos() })
export const logosPressDefault = (): LogosBaseData => ({ title: '언론에 소개된 우리', logos: baseLogos().slice(0, 4) })
export const logosPartnersDefault = (): LogosBaseData => ({ title: '협력 기관', logos: baseLogos().slice(0, 4) })
