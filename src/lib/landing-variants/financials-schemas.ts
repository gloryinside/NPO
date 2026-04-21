import { z } from 'zod'

// 공통 숫자 포맷: 원 단위 정수
const KRW = z.number().int().min(0)

const BreakdownItem = z.object({
  label: z.string().min(1).max(40),
  amount: KRW,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
})

const YearlyItem = z.object({
  year: z.number().int().min(2000).max(2100),
  raised: KRW,
  used: KRW,
})

const TransparencyItem = z.object({
  category: z.string().min(1).max(60),
  amount: KRW,
  note: z.string().max(200).optional(),
  documentUrl: z.string().url().optional(),
})

export const FinancialsSummary = z.object({
  title: z.string().max(100).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  totalRaised: KRW,
  totalUsed: KRW,
  balance: KRW.optional(),
})

export const FinancialsBreakdown = z.object({
  title: z.string().max(100).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  totalUsed: KRW,
  breakdown: z.array(BreakdownItem).min(2).max(8),
})

export const FinancialsTimeline = z.object({
  title: z.string().max(100).optional(),
  years: z.array(YearlyItem).min(1).max(10),
})

export const FinancialsTransparency = z.object({
  title: z.string().max(100).optional(),
  year: z.number().int().min(2000).max(2100).optional(),
  totalRaised: KRW,
  totalUsed: KRW,
  items: z.array(TransparencyItem).min(1).max(20),
  reportUrl: z.string().url().optional(),   // 감사보고서 전체 PDF
})

export type FinancialsSummaryData = z.infer<typeof FinancialsSummary>
export type FinancialsBreakdownData = z.infer<typeof FinancialsBreakdown>
export type FinancialsTimelineData = z.infer<typeof FinancialsTimeline>
export type FinancialsTransparencyData = z.infer<typeof FinancialsTransparency>

const lastYear = new Date().getFullYear() - 1

export const financialsSummaryDefault = (): FinancialsSummaryData => ({
  title: '재무 투명성',
  year: lastYear,
  totalRaised: 320_000_000,
  totalUsed: 280_000_000,
  balance: 40_000_000,
})

export const financialsBreakdownDefault = (): FinancialsBreakdownData => ({
  title: '사용 내역 분포',
  year: lastYear,
  totalUsed: 280_000_000,
  breakdown: [
    { label: '사업비', amount: 224_000_000, color: '#7c3aed' },
    { label: '관리비', amount: 33_600_000, color: '#38bdf8' },
    { label: '모금비', amount: 22_400_000, color: '#f59e0b' },
  ],
})

export const financialsTimelineDefault = (): FinancialsTimelineData => ({
  title: '연도별 모금/사용',
  years: [
    { year: lastYear - 2, raised: 180_000_000, used: 165_000_000 },
    { year: lastYear - 1, raised: 245_000_000, used: 220_000_000 },
    { year: lastYear,     raised: 320_000_000, used: 280_000_000 },
  ],
})

export const financialsTransparencyDefault = (): FinancialsTransparencyData => ({
  title: '상세 사용 내역',
  year: lastYear,
  totalRaised: 320_000_000,
  totalUsed: 280_000_000,
  items: [
    { category: '아동 교육 지원 프로그램', amount: 120_000_000, note: '수혜 아동 350명' },
    { category: '해외 긴급 구호', amount: 80_000_000, note: '동남아 3개국' },
    { category: '청소년 멘토링', amount: 24_000_000, note: '멘티 500명 연결' },
    { category: '기관 운영', amount: 33_600_000, note: '인건비·임대료 등' },
    { category: '모금 활동', amount: 22_400_000, note: '캠페인·홍보' },
  ],
  reportUrl: undefined,
})
