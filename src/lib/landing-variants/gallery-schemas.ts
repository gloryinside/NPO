import { z } from 'zod'

const GalleryImage = z.object({
  url: z.string().url(),
  alt: z.string().min(1).max(200),
  caption: z.string().max(200).optional(),
})

export const GalleryBase = z.object({
  title: z.string().max(100).optional(),
  images: z.array(GalleryImage).min(1).max(30),
})

export const GalleryGrid = GalleryBase
export const GalleryMasonry = GalleryBase
export const GalleryLightbox = GalleryBase
export const GalleryCarousel = GalleryBase
export const GalleryFullbleed = GalleryBase

export type GalleryBaseData = z.infer<typeof GalleryBase>

const baseImages = () => ([
  { url: 'https://picsum.photos/seed/g-a/800/600', alt: '활동 현장 1', caption: '지역 봉사 현장' },
  { url: 'https://picsum.photos/seed/g-b/800/600', alt: '활동 현장 2', caption: '캠페인 행사' },
  { url: 'https://picsum.photos/seed/g-c/800/1000', alt: '활동 현장 3' },
  { url: 'https://picsum.photos/seed/g-d/800/600', alt: '활동 현장 4' },
  { url: 'https://picsum.photos/seed/g-e/800/700', alt: '활동 현장 5' },
  { url: 'https://picsum.photos/seed/g-f/800/500', alt: '활동 현장 6' },
])

export const galleryGridDefault = (): GalleryBaseData => ({ title: '활동 현장', images: baseImages() })
export const galleryMasonryDefault = (): GalleryBaseData => ({ title: '순간들', images: baseImages() })
export const galleryLightboxDefault = (): GalleryBaseData => ({ title: '갤러리', images: baseImages() })
export const galleryCarouselDefault = (): GalleryBaseData => ({ title: '활동 스냅샷', images: baseImages() })
export const galleryFullbleedDefault = (): GalleryBaseData => ({ title: '현장의 이야기', images: baseImages().slice(0, 4) })
