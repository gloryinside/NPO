import { registerVariants } from './index'
import * as S from './testimonials-schemas'

registerVariants('testimonials', [
  {
    id: 'testimonials-cards', type: 'testimonials', label: '카드',
    description: '3열 카드 그리드. 짧은 후기를 다수 노출.',
    preview: '/landing-variants/testimonials-cards.svg', visualWeight: 'minimal',
    dataSchema: S.TestimonialsCards, defaultData: S.testimonialsCardsDefault,
  },
  {
    id: 'testimonials-carousel', type: 'testimonials', label: '캐러셀',
    description: '한 번에 하나씩 크게. 인디케이터 + 이전/다음 버튼.',
    preview: '/landing-variants/testimonials-carousel.svg', visualWeight: 'bold',
    dataSchema: S.TestimonialsCarousel, defaultData: S.testimonialsCarouselDefault,
  },
  {
    id: 'testimonials-wall', type: 'testimonials', label: '월 (Masonry)',
    description: '높이 비대칭 masonry. 소셜 벽 느낌.',
    preview: '/landing-variants/testimonials-wall.svg', visualWeight: 'bold',
    dataSchema: S.TestimonialsWall, defaultData: S.testimonialsWallDefault,
  },
  {
    id: 'testimonials-quote-large', type: 'testimonials', label: '대형 인용문',
    description: '풀폭 대형 인용문. 스크롤로 다음 후기.',
    preview: '/landing-variants/testimonials-quote-large.svg', visualWeight: 'cinematic',
    dataSchema: S.TestimonialsQuoteLarge, defaultData: S.testimonialsQuoteLargeDefault,
  },
  {
    id: 'testimonials-video', type: 'testimonials', label: '영상 후기',
    description: '비디오 썸네일 그리드. 클릭 시 모달 재생.',
    preview: '/landing-variants/testimonials-video.svg', visualWeight: 'cinematic',
    dataSchema: S.TestimonialsVideo, defaultData: S.testimonialsVideoDefault,
  },
])
