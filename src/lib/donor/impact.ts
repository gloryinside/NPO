import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * 후원자 개인 임팩트 집계.
 * 기준: payments.pay_status = 'paid' 인 행만 합산.
 *
 * 반환값:
 * - totalAmount: 누적 후원액 (원)
 * - paymentCount: 결제 건수
 * - activeMonths: 후원 시작월 ~ 최근 납입월 사이 개월 수 (1 이상)
 * - byCampaign: 캠페인별 집계 (금액 내림차순)
 * - byYear: 연도별 집계 (연도 오름차순)
 * - firstPayDate / lastPayDate: ISO string or null
 */
export interface DonorImpact {
  totalAmount: number
  paymentCount: number
  activeMonths: number
  byCampaign: Array<{ campaignId: string | null; title: string; amount: number; count: number }>
  byYear: Array<{ year: number; amount: number; count: number }>
  firstPayDate: string | null
  lastPayDate: string | null
}

export async function getDonorImpact(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<DonorImpact> {
  const { data, error } = await supabase
    .from('payments')
    .select('amount, pay_date, campaign_id, campaigns(id, title)')
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .order('pay_date', { ascending: true })

  if (error) {
    console.error('[donor/impact] DB error:', error.message)
    return emptyImpact()
  }

  const rows = (data ?? []) as unknown as Array<{
    amount: number | null
    pay_date: string | null
    campaign_id: string | null
    campaigns?: { id: string; title: string } | null
  }>

  if (rows.length === 0) return emptyImpact()

  let totalAmount = 0
  const campaignMap = new Map<string, { campaignId: string | null; title: string; amount: number; count: number }>()
  const yearMap = new Map<number, { year: number; amount: number; count: number }>()
  let firstPayDate: string | null = null
  let lastPayDate: string | null = null

  for (const r of rows) {
    const amt = Number(r.amount ?? 0)
    totalAmount += amt

    // 캠페인별
    const cKey = r.campaigns?.id ?? '__none__'
    const cTitle = r.campaigns?.title ?? '일반 후원'
    const cCurr = campaignMap.get(cKey) ?? { campaignId: r.campaign_id, title: cTitle, amount: 0, count: 0 }
    cCurr.amount += amt
    cCurr.count += 1
    campaignMap.set(cKey, cCurr)

    // 연도별
    if (r.pay_date) {
      const year = new Date(r.pay_date).getFullYear()
      if (Number.isFinite(year)) {
        const yCurr = yearMap.get(year) ?? { year, amount: 0, count: 0 }
        yCurr.amount += amt
        yCurr.count += 1
        yearMap.set(year, yCurr)
      }
      if (!firstPayDate || r.pay_date < firstPayDate) firstPayDate = r.pay_date
      if (!lastPayDate || r.pay_date > lastPayDate) lastPayDate = r.pay_date
    }
  }

  const byCampaign = [...campaignMap.values()].sort((a, b) => b.amount - a.amount)
  const byYear = [...yearMap.values()].sort((a, b) => a.year - b.year)

  // activeMonths 계산 (최소 1)
  let activeMonths = 1
  if (firstPayDate && lastPayDate) {
    const s = new Date(firstPayDate)
    const e = new Date(lastPayDate)
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1
    activeMonths = Math.max(1, months)
  }

  return {
    totalAmount,
    paymentCount: rows.length,
    activeMonths,
    byCampaign,
    byYear,
    firstPayDate,
    lastPayDate,
  }
}

function emptyImpact(): DonorImpact {
  return {
    totalAmount: 0,
    paymentCount: 0,
    activeMonths: 0,
    byCampaign: [],
    byYear: [],
    firstPayDate: null,
    lastPayDate: null,
  }
}
