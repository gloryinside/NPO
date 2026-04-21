import { registerVariants } from './index'
import * as S from './logos-schemas'

registerVariants('logos', [
  { id: 'logos-grid', type: 'logos', label: '그리드',
    description: '균일 그리드 + grayscale hover.',
    preview: '/landing-variants/logos-grid.svg', visualWeight: 'minimal',
    dataSchema: S.LogosGrid, defaultData: S.logosGridDefault },
  { id: 'logos-marquee', type: 'logos', label: '무한 스크롤',
    description: '좌→우 자동 스크롤 띠.',
    preview: '/landing-variants/logos-marquee.svg', visualWeight: 'bold',
    dataSchema: S.LogosMarquee, defaultData: S.logosMarqueeDefault },
  { id: 'logos-press', type: 'logos', label: '언론 보도',
    description: '"As Seen In" 형태, 2×2 또는 1×4 배치.',
    preview: '/landing-variants/logos-press.svg', visualWeight: 'bold',
    dataSchema: S.LogosPress, defaultData: S.logosPressDefault },
  { id: 'logos-partners', type: 'logos', label: '파트너 카드',
    description: '각 로고에 기관명 라벨 카드.',
    preview: '/landing-variants/logos-partners.svg', visualWeight: 'minimal',
    dataSchema: S.LogosPartners, defaultData: S.logosPartnersDefault },
])
