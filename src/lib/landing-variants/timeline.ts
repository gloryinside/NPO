import { registerVariants } from './index'
import * as S from './timeline-schemas'

registerVariants('timeline', [
  { id: 'timeline-vertical', type: 'timeline', label: '수직 타임라인',
    description: '좌측 축 + 우측 이벤트. 가장 일반적.',
    preview: '/landing-variants/timeline-vertical.svg', visualWeight: 'minimal',
    dataSchema: S.TimelineVertical, defaultData: S.timelineVerticalDefault },
  { id: 'timeline-alternating', type: 'timeline', label: '좌우 교차',
    description: '중앙 축 기준 좌우 교차 배치.',
    preview: '/landing-variants/timeline-alternating.svg', visualWeight: 'bold',
    dataSchema: S.TimelineAlternating, defaultData: S.timelineAlternatingDefault },
  { id: 'timeline-horizontal', type: 'timeline', label: '가로 타임라인',
    description: '가로 스크롤 타임라인.',
    preview: '/landing-variants/timeline-horizontal.svg', visualWeight: 'bold',
    dataSchema: S.TimelineHorizontal, defaultData: S.timelineHorizontalDefault },
  { id: 'timeline-milestones', type: 'timeline', label: '이정표 카드',
    description: '이미지 카드 그리드로 주요 이정표 강조.',
    preview: '/landing-variants/timeline-milestones.svg', visualWeight: 'cinematic',
    dataSchema: S.TimelineMilestones, defaultData: S.timelineMilestonesDefault },
])
