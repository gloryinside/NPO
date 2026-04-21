import { registerVariants } from './index'
import * as S from './impact-schemas'

registerVariants('impact', [
  { id: 'impact-alternating', type: 'impact', label: '좌우 교차',
    description: '이미지 좌/우 교차 배치. 현재 기본 레이아웃.',
    preview: '/landing-variants/impact-alternating.svg', visualWeight: 'minimal',
    dataSchema: S.ImpactAlternating, defaultData: S.impactAlternatingDefault },
  { id: 'impact-zigzag', type: 'impact', label: '지그재그 (배경 교차)',
    description: '교차 배치 + 블록마다 배경색 변화.',
    preview: '/landing-variants/impact-zigzag.svg', visualWeight: 'bold',
    dataSchema: S.ImpactZigzag, defaultData: S.impactZigzagDefault },
  { id: 'impact-cards', type: 'impact', label: '카드 그리드',
    description: '이미지 상단 카드를 3열로 배치.',
    preview: '/landing-variants/impact-cards.svg', visualWeight: 'bold',
    dataSchema: S.ImpactCards, defaultData: S.impactCardsDefault },
  { id: 'impact-storytelling', type: 'impact', label: '풀폭 스토리',
    description: '풀폭 이미지 + 중앙 텍스트. 시네마틱 스토리텔링.',
    preview: '/landing-variants/impact-storytelling.svg', visualWeight: 'cinematic',
    dataSchema: S.ImpactStorytelling, defaultData: S.impactStorytellingDefault },
  { id: 'impact-before-after', type: 'impact', label: 'Before/After',
    description: '이미지 비교 슬라이더. 드래그로 비교.',
    preview: '/landing-variants/impact-before-after.svg', visualWeight: 'cinematic',
    dataSchema: S.ImpactBeforeAfter, defaultData: S.impactBeforeAfterDefault },
])
