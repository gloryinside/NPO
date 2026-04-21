import { registerVariants } from './index'
import * as S from './hero-schemas'
import * as D from './hero-defaults'

registerVariants('hero', [
  {
    id: 'hero-minimal', type: 'hero', label: '미니멀',
    description: '단색 배경 + 중앙 텍스트 + CTA. 단정하고 깔끔한 첫 인상.',
    preview: '/landing-variants/hero-minimal.svg', visualWeight: 'minimal',
    dataSchema: S.HeroMinimal, defaultData: D.heroMinimalDefault,
  },
  {
    id: 'hero-split-image', type: 'hero', label: '분할 이미지',
    description: '좌측 텍스트+CTA / 우측 이미지 분할. 모바일은 스택.',
    preview: '/landing-variants/hero-split-image.svg', visualWeight: 'bold',
    dataSchema: S.HeroSplitImage, defaultData: D.heroSplitImageDefault,
  },
  {
    id: 'hero-fullscreen-image', type: 'hero', label: '풀스크린 이미지',
    description: '80vh 배경 이미지 + Ken Burns 애니메이션. 임팩트 강조.',
    preview: '/landing-variants/hero-fullscreen-image.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroFullscreenImage, defaultData: D.heroFullscreenImageDefault,
  },
  {
    id: 'hero-fullscreen-video', type: 'hero', label: '풀스크린 비디오',
    description: '배경 영상 autoplay, 모바일은 포스터 이미지 fallback.',
    preview: '/landing-variants/hero-fullscreen-video.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroFullscreenVideo, defaultData: D.heroFullscreenVideoDefault,
  },
  {
    id: 'hero-gallery', type: 'hero', label: '이미지 갤러리',
    description: '배경 이미지 여러 장이 crossfade. 활동 다양성 강조.',
    preview: '/landing-variants/hero-gallery.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroGallery, defaultData: D.heroGalleryDefault,
  },
  {
    id: 'hero-stats-overlay', type: 'hero', label: '통계 오버레이',
    description: '풀스크린 이미지 하단에 주요 지표 오버레이.',
    preview: '/landing-variants/hero-stats-overlay.svg', visualWeight: 'bold',
    dataSchema: S.HeroStatsOverlay, defaultData: D.heroStatsOverlayDefault,
  },
])
