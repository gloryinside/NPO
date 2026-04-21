import { z } from 'zod'

const TimelineEvent = z.object({
  year: z.string().min(1).max(20),
  title: z.string().min(1).max(100),
  body: z.string().max(500).optional(),
  imageUrl: z.string().url().optional(),
})

export const TimelineBase = z.object({
  title: z.string().max(100).optional(),
  events: z.array(TimelineEvent).min(1).max(20),
})

export const TimelineVertical = TimelineBase
export const TimelineAlternating = TimelineBase
export const TimelineHorizontal = TimelineBase
export const TimelineMilestones = TimelineBase

export type TimelineBaseData = z.infer<typeof TimelineBase>

const baseEvents = () => ([
  { year: '2020', title: '기관 설립', body: '비영리 단체로 출범했습니다.' },
  { year: '2022', title: '누적 1억 모금', body: '후원자 500명이 함께했습니다.' },
  { year: '2024', title: '해외 사업 확장', body: '동남아 3개국으로 활동 영역을 넓혔습니다.' },
  { year: '2026', title: '누적 3억 모금', body: '후원자 1,200명이 함께하고 있습니다.' },
])

export const timelineVerticalDefault = (): TimelineBaseData => ({ title: '우리의 발자취', events: baseEvents() })
export const timelineAlternatingDefault = (): TimelineBaseData => ({ title: '우리의 여정', events: baseEvents() })
export const timelineHorizontalDefault = (): TimelineBaseData => ({ title: '주요 이정표', events: baseEvents() })
export const timelineMilestonesDefault = (): TimelineBaseData => ({
  title: '이정표',
  events: baseEvents().map((e, i) => ({ ...e, imageUrl: `https://picsum.photos/seed/tl-${i}/800/600` })),
})
