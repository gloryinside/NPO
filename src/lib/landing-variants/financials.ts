import { registerVariants } from './index'
import * as S from './financials-schemas'

registerVariants('financials', [
  {
    id: 'financials-summary', type: 'financials', label: '요약 지표',
    description: '올해 총 모금/집행/잔액 3대 지표 카드. 깔끔한 첫 인상.',
    preview: '/landing-variants/financials-summary.svg', visualWeight: 'minimal',
    dataSchema: S.FinancialsSummary, defaultData: S.financialsSummaryDefault,
  },
  {
    id: 'financials-breakdown', type: 'financials', label: '사용 분포 (파이)',
    description: '사업비/관리비/모금비 파이 차트 + 카테고리별 비율.',
    preview: '/landing-variants/financials-breakdown.svg', visualWeight: 'bold',
    dataSchema: S.FinancialsBreakdown, defaultData: S.financialsBreakdownDefault,
  },
  {
    id: 'financials-timeline', type: 'financials', label: '연도별 추이',
    description: '연도별 모금액/사용액 막대 그래프.',
    preview: '/landing-variants/financials-timeline.svg', visualWeight: 'bold',
    dataSchema: S.FinancialsTimeline, defaultData: S.financialsTimelineDefault,
  },
  {
    id: 'financials-transparency', type: 'financials', label: '투명성 리포트',
    description: '상세 사용 내역 표 + 증빙 문서 링크 + 감사보고서 CTA.',
    preview: '/landing-variants/financials-transparency.svg', visualWeight: 'cinematic',
    dataSchema: S.FinancialsTransparency, defaultData: S.financialsTransparencyDefault,
  },
])
