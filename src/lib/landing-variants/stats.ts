import { registerVariants } from './index'
import * as S from './stats-schemas'
import * as D from './stats-defaults'

registerVariants('stats', [
  {
    id: 'stats-grid', type: 'stats', label: '그리드',
    description: '가로 4열 그리드. 현재 기본 레이아웃.',
    preview: '/landing-variants/stats-grid.svg', visualWeight: 'minimal',
    dataSchema: S.StatsGrid, defaultData: D.statsGridDefault,
  },
  {
    id: 'stats-inline', type: 'stats', label: '한 줄',
    description: '가로 1줄 인라인. 낮은 높이로 섹션 사이 삽입.',
    preview: '/landing-variants/stats-inline.svg', visualWeight: 'minimal',
    dataSchema: S.StatsInline, defaultData: D.statsInlineDefault,
  },
  {
    id: 'stats-cards', type: 'stats', label: '카드',
    description: '카드 형태 + hover 리프트. 시각적 분리.',
    preview: '/landing-variants/stats-cards.svg', visualWeight: 'bold',
    dataSchema: S.StatsCards, defaultData: D.statsCardsDefault,
  },
  {
    id: 'stats-countup', type: 'stats', label: '카운트업',
    description: '스크롤 진입 시 숫자 0→N 애니메이션.',
    preview: '/landing-variants/stats-countup.svg', visualWeight: 'bold',
    dataSchema: S.StatsCountup, defaultData: D.statsCountupDefault,
  },
  {
    id: 'stats-big', type: 'stats', label: '대형 숫자',
    description: '거대 display 타이포 + 그라디언트 배경.',
    preview: '/landing-variants/stats-big.svg', visualWeight: 'cinematic',
    dataSchema: S.StatsBig, defaultData: D.statsBigDefault,
  },
])
