import { registerVariants } from './index'
import * as S from './team-schemas'

registerVariants('team', [
  { id: 'team-grid', type: 'team', label: '그리드',
    description: '원형 아바타 4열 그리드. 현재 기본.',
    preview: '/landing-variants/team-grid.svg', visualWeight: 'minimal',
    dataSchema: S.TeamGrid, defaultData: S.teamGridDefault },
  { id: 'team-cards', type: 'team', label: '카드 + 호버',
    description: '사각 사진 카드 + hover 시 bio 오버레이.',
    preview: '/landing-variants/team-cards.svg', visualWeight: 'bold',
    dataSchema: S.TeamCards, defaultData: S.teamCardsDefault },
  { id: 'team-featured', type: 'team', label: '대표 강조',
    description: '대표 1명 대형 + 나머지 작게.',
    preview: '/landing-variants/team-featured.svg', visualWeight: 'bold',
    dataSchema: S.TeamFeatured, defaultData: S.teamFeaturedDefault },
  { id: 'team-carousel', type: 'team', label: '캐러셀',
    description: '가로 스크롤 캐러셀. 사진 큰 사이즈.',
    preview: '/landing-variants/team-carousel.svg', visualWeight: 'bold',
    dataSchema: S.TeamCarousel, defaultData: S.teamCarouselDefault },
  { id: 'team-org-chart', type: 'team', label: '조직도',
    description: '계층 구조 트리. 각 팀원의 parent 필드로 구성.',
    preview: '/landing-variants/team-org-chart.svg', visualWeight: 'cinematic',
    dataSchema: S.TeamOrgChart, defaultData: S.teamOrgChartDefault },
])
