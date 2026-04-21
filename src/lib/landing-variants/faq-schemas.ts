import { z } from 'zod'

const FaqItem = z.object({
  q: z.string().min(1).max(200),
  a: z.string().min(1).max(2000),
  category: z.string().max(40).optional(),
})

export const FaqBase = z.object({
  title: z.string().max(100).optional(),
  items: z.array(FaqItem).min(1).max(30),
})

export const FaqAccordion = FaqBase
export const FaqTwoColumn = FaqBase
export const FaqCategorized = FaqBase
export const FaqSearch = FaqBase

export type FaqBaseData = z.infer<typeof FaqBase>

const baseItems = () => ([
  { q: '기부금 영수증은 언제 받을 수 있나요?', a: '매년 연말 국세청 간소화 서비스를 통해 자동 제공됩니다. 별도 신청이 필요하면 마이페이지에서 요청 가능합니다.', category: '영수증' },
  { q: '정기 후원 해지는 어떻게 하나요?', a: '마이페이지 > 정기후원 관리에서 언제든 해지하실 수 있습니다. 위약금이나 해지 수수료는 없습니다.', category: '정기 후원' },
  { q: '후원금은 어떻게 사용되나요?', a: '투명 리포트를 통해 매 분기 사용 내역을 공개합니다. 회계 감사도 매년 진행됩니다.', category: '투명성' },
  { q: '후원자 정보는 안전하게 관리되나요?', a: '개인정보보호법에 따라 암호화 저장되며, 어떠한 제3자에게도 제공되지 않습니다.', category: '개인정보' },
])

export const faqAccordionDefault = (): FaqBaseData => ({ title: '자주 묻는 질문', items: baseItems() })
export const faqTwoColumnDefault = (): FaqBaseData => ({ title: '자주 묻는 질문', items: baseItems() })
export const faqCategorizedDefault = (): FaqBaseData => ({ title: '카테고리별 FAQ', items: baseItems() })
export const faqSearchDefault = (): FaqBaseData => ({ title: '궁금한 점을 검색하세요', items: baseItems() })
