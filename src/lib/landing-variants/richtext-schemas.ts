import { z } from 'zod'

export const RichtextBase = z.object({
  title: z.string().max(100).optional(),
  content: z.string().max(10000),
})

export const RichtextPlain = RichtextBase
export const RichtextBoxed = RichtextBase
export const RichtextQuote = RichtextBase.extend({
  author: z.string().max(60).optional(),
})

export type RichtextBaseData = z.infer<typeof RichtextBase>
export type RichtextQuoteData = z.infer<typeof RichtextQuote>

export const richtextPlainDefault = (): RichtextBaseData => ({
  title: '',
  content: '<p>내용을 입력하세요. HTML 태그를 사용할 수 있습니다.</p>',
})
export const richtextBoxedDefault = (): RichtextBaseData => ({
  title: '알림 사항',
  content: '<p>이곳은 강조 박스로 표시됩니다.</p>',
})
export const richtextQuoteDefault = (): RichtextQuoteData => ({
  title: '',
  content: '작은 후원이 모여 큰 변화를 만듭니다.',
  author: '기관 대표',
})
