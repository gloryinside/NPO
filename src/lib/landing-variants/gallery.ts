import { registerVariants } from './index'
import * as S from './gallery-schemas'

registerVariants('gallery', [
  { id: 'gallery-grid', type: 'gallery', label: '균일 그리드',
    description: '정사각형 균일 그리드. 깔끔한 기본형.',
    preview: '/landing-variants/gallery-grid.svg', visualWeight: 'minimal',
    dataSchema: S.GalleryGrid, defaultData: S.galleryGridDefault },
  { id: 'gallery-masonry', type: 'gallery', label: 'Masonry',
    description: '높이 비대칭 배치. 다양한 비율 이미지에 적합.',
    preview: '/landing-variants/gallery-masonry.svg', visualWeight: 'bold',
    dataSchema: S.GalleryMasonry, defaultData: S.galleryMasonryDefault },
  { id: 'gallery-lightbox', type: 'gallery', label: 'Lightbox',
    description: '그리드 + 클릭 시 전체화면 뷰어 (←/→/ESC).',
    preview: '/landing-variants/gallery-lightbox.svg', visualWeight: 'bold',
    dataSchema: S.GalleryLightbox, defaultData: S.galleryLightboxDefault },
  { id: 'gallery-carousel', type: 'gallery', label: '가로 캐러셀',
    description: 'snap 스크롤 캐러셀.',
    preview: '/landing-variants/gallery-carousel.svg', visualWeight: 'bold',
    dataSchema: S.GalleryCarousel, defaultData: S.galleryCarouselDefault },
  { id: 'gallery-fullbleed', type: 'gallery', label: '풀폭 스크롤',
    description: '풀폭 이미지 스크롤 + 하단 캡션 오버레이.',
    preview: '/landing-variants/gallery-fullbleed.svg', visualWeight: 'cinematic',
    dataSchema: S.GalleryFullbleed, defaultData: S.galleryFullbleedDefault },
])
