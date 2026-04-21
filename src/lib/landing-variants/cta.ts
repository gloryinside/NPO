import { registerVariants } from './index'
import * as S from './cta-schemas'
import * as D from './cta-defaults'

registerVariants('cta', [
  {
    id: 'cta-banner', type: 'cta', label: '배너',
    description: '단색 배경 + 중앙 버튼. 깔끔한 기본형.',
    preview: '/landing-variants/cta-banner.svg', visualWeight: 'minimal',
    dataSchema: S.CtaBanner, defaultData: D.ctaBannerDefault,
  },
  {
    id: 'cta-gradient', type: 'cta', label: '그라디언트',
    description: '그라디언트 배경 + 대형 버튼. 시각적 강조.',
    preview: '/landing-variants/cta-gradient.svg', visualWeight: 'bold',
    dataSchema: S.CtaGradient, defaultData: D.ctaGradientDefault,
  },
  {
    id: 'cta-split', type: 'cta', label: '좌우 분할',
    description: '좌측 메시지 / 우측 버튼 + 보조 정보(전화 등).',
    preview: '/landing-variants/cta-split.svg', visualWeight: 'bold',
    dataSchema: S.CtaSplit, defaultData: D.ctaSplitDefault,
  },
  {
    id: 'cta-urgency', type: 'cta', label: '긴급 (D-day)',
    description: 'D-day 카운터 + 목표 달성률. 마감 임박 강조.',
    preview: '/landing-variants/cta-urgency.svg', visualWeight: 'cinematic',
    dataSchema: S.CtaUrgency, defaultData: D.ctaUrgencyDefault,
  },
  {
    id: 'cta-fullscreen', type: 'cta', label: '풀스크린',
    description: '80vh 이미지 배경 + 대형 버튼. 섹션 마지막 임팩트.',
    preview: '/landing-variants/cta-fullscreen.svg', visualWeight: 'cinematic',
    dataSchema: S.CtaFullscreen, defaultData: D.ctaFullscreenDefault,
  },
])
