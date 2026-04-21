import type { StatsGridData, StatsInlineData, StatsCardsData, StatsCountupData, StatsBigData } from './stats-schemas'

const baseItems = () => ([
  { icon: '👥', value: '1,200+', label: '누적 후원자' },
  { icon: '💰', value: '320,000,000', label: '누적 모금액 (원)' },
  { icon: '📋', value: '24', label: '진행 캠페인' },
  { icon: '🌱', value: '5', label: '활동 연차' },
])

export const statsGridDefault = (): StatsGridData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsInlineDefault = (): StatsInlineData => ({ title: '', items: baseItems() })
export const statsCardsDefault = (): StatsCardsData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsCountupDefault = (): StatsCountupData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsBigDefault = (): StatsBigData => ({
  title: '우리의 영향력',
  items: baseItems().slice(0, 3),
  gradient: true,
})
