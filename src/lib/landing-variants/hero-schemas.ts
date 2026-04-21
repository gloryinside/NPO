import { z } from 'zod'

export const HeroBase = z.object({
  headline: z.string().min(1).max(100),
  subheadline: z.string().max(300).optional(),
  ctaText: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
})

export const HeroMinimal = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
})

export const HeroSplitImage = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  rightImageUrl: z.string().url(),
  imageRatio: z.enum(['1:1', '4:3', '3:4']).default('1:1'),
})

export const HeroFullscreenImage = HeroBase.extend({
  bgImageUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(40),
  kenBurns: z.boolean().default(true),
})

export const HeroFullscreenVideo = HeroBase.extend({
  videoUrl: z.string().url(),
  posterUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(50),
  showMuteToggle: z.boolean().default(true),
})

export const HeroGallery = HeroBase.extend({
  images: z.array(z.object({ url: z.string().url(), alt: z.string().min(1).max(200) })).min(2).max(8),
  intervalMs: z.number().min(3000).max(15000).default(6000),
  overlayOpacity: z.number().min(30).max(100).default(40),
})

export const HeroStatsOverlay = HeroFullscreenImage.extend({
  stats: z.array(z.object({ value: z.string().max(20), label: z.string().max(40) })).min(2).max(4),
})

export type HeroMinimalData = z.infer<typeof HeroMinimal>
export type HeroSplitImageData = z.infer<typeof HeroSplitImage>
export type HeroFullscreenImageData = z.infer<typeof HeroFullscreenImage>
export type HeroFullscreenVideoData = z.infer<typeof HeroFullscreenVideo>
export type HeroGalleryData = z.infer<typeof HeroGallery>
export type HeroStatsOverlayData = z.infer<typeof HeroStatsOverlay>
