import { registerVariants } from './index'
import * as S from './campaigns-schemas'

registerVariants('campaigns', [
  { id: 'campaigns-grid', type: 'campaigns', label: '그리드',
    description: '3열 카드 그리드. 현재 기본 레이아웃.',
    preview: '/landing-variants/campaigns-grid.svg', visualWeight: 'minimal',
    dataSchema: S.CampaignsGrid, defaultData: S.campaignsGridDefault },
  { id: 'campaigns-featured', type: 'campaigns', label: '추천 + 목록',
    description: '대표 1개 대형 + 나머지 작은 카드.',
    preview: '/landing-variants/campaigns-featured.svg', visualWeight: 'bold',
    dataSchema: S.CampaignsFeatured, defaultData: S.campaignsFeaturedDefault },
  { id: 'campaigns-carousel', type: 'campaigns', label: '가로 캐러셀',
    description: 'snap 스크롤 캐러셀.',
    preview: '/landing-variants/campaigns-carousel.svg', visualWeight: 'bold',
    dataSchema: S.CampaignsCarousel, defaultData: S.campaignsCarouselDefault },
  { id: 'campaigns-list', type: 'campaigns', label: '세로 리스트',
    description: '세로 리스트 + 진행률 바 강조.',
    preview: '/landing-variants/campaigns-list.svg', visualWeight: 'minimal',
    dataSchema: S.CampaignsList, defaultData: S.campaignsListDefault },
  { id: 'campaigns-masonry', type: 'campaigns', label: 'Masonry',
    description: '높이 비대칭 masonry 레이아웃.',
    preview: '/landing-variants/campaigns-masonry.svg', visualWeight: 'cinematic',
    dataSchema: S.CampaignsMasonry, defaultData: S.campaignsMasonryDefault },
])
