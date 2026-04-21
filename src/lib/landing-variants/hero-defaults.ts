import type {
  HeroMinimalData, HeroSplitImageData, HeroFullscreenImageData,
  HeroFullscreenVideoData, HeroGalleryData, HeroStatsOverlayData,
} from './hero-schemas'

export const heroMinimalDefault = (): HeroMinimalData => ({
  bgColor: '#1a3a5c',
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroSplitImageDefault = (): HeroSplitImageData => ({
  bgColor: '#ffffff',
  rightImageUrl: 'https://picsum.photos/seed/hero-split/800/800',
  imageRatio: '1:1',
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'left',
})

export const heroFullscreenImageDefault = (): HeroFullscreenImageData => ({
  bgImageUrl: 'https://picsum.photos/seed/hero-fs/1920/1080',
  overlayOpacity: 50,
  kenBurns: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroFullscreenVideoDefault = (): HeroFullscreenVideoData => ({
  videoUrl: 'https://cdn.coverr.co/videos/coverr-community-volunteering-5670/1080p.mp4',
  posterUrl: 'https://picsum.photos/seed/hero-video/1920/1080',
  overlayOpacity: 50,
  showMuteToggle: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroGalleryDefault = (): HeroGalleryData => ({
  images: [
    { url: 'https://picsum.photos/seed/g1/1600/900', alt: '아이들과 함께하는 활동' },
    { url: 'https://picsum.photos/seed/g2/1600/900', alt: '지역사회 캠페인 현장' },
    { url: 'https://picsum.photos/seed/g3/1600/900', alt: '후원자 봉사 현장' },
  ],
  intervalMs: 6000,
  overlayOpacity: 45,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroStatsOverlayDefault = (): HeroStatsOverlayData => ({
  bgImageUrl: 'https://picsum.photos/seed/hero-so/1920/1080',
  overlayOpacity: 55,
  kenBurns: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
  stats: [
    { value: '1,200+', label: '누적 후원자' },
    { value: '₩3.2억', label: '누적 모금액' },
    { value: '5년', label: '활동 기간' },
  ],
})
