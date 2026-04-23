import type { SupabaseClient } from '@supabase/supabase-js'

export interface CampaignReport {
  campaign: {
    id: string
    title: string
    goal_amount: number | null
    status: string
    started_at: string | null
    ended_at: string | null
  }
  totals: {
    raised: number
    goalPct: number | null
    paidCount: number
    uniqueDonors: number
    avgAmount: number
    /** G-D83 */
    failedCount: number
    cancelledCount: number
    refundCount: number
    refundAmount: number
    failureRatio: number // 0~1 (failed+cancelled / attempted)
  }
  dailyRaised: Array<{ date: string; amount: number; count: number }>
  topDonors: Array<{ memberName: string; amount: number; count: number }>
  retentionSplit: { firstTime: number; recurring: number }
}

/**
 * 캠페인 종료 리포트 집계.
 * - paid 결제만 대상
 * - topDonors: 기부액 기준 상위 10명
 * - retentionSplit: 해당 캠페인 외 다른 결제 이력이 있으면 'recurring', 아니면 'firstTime'
 */
export async function getCampaignReport(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignReport | null> {
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, goal_amount, status, started_at, ended_at, org_id')
    .eq('id', campaignId)
    .maybeSingle()

  if (!campaign) return null

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, pay_date, member_id, members(name)')
    .eq('campaign_id', campaignId)
    .eq('pay_status', 'paid')
    .order('pay_date', { ascending: true })

  const rows = (payments ?? []) as unknown as Array<{
    amount: number | null
    pay_date: string | null
    member_id: string | null
    members?: { name: string } | null
  }>

  let raised = 0
  const paidCount = rows.length
  const uniqueMembers = new Set<string>()
  const dailyMap = new Map<string, { date: string; amount: number; count: number }>()
  const donorMap = new Map<string, { memberName: string; amount: number; count: number }>()

  for (const r of rows) {
    const amt = Number(r.amount ?? 0)
    raised += amt
    if (r.member_id) uniqueMembers.add(r.member_id)

    if (r.pay_date) {
      const day = r.pay_date.slice(0, 10)  // YYYY-MM-DD
      const cur = dailyMap.get(day) ?? { date: day, amount: 0, count: 0 }
      cur.amount += amt
      cur.count += 1
      dailyMap.set(day, cur)
    }

    if (r.member_id) {
      const name = r.members?.name ?? '익명'
      const cur = donorMap.get(r.member_id) ?? { memberName: name, amount: 0, count: 0 }
      cur.amount += amt
      cur.count += 1
      donorMap.set(r.member_id, cur)
    }
  }

  const dailyRaised = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date))
  const topDonors = [...donorMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 10)

  // retention: 이 캠페인 기여자 중 다른 캠페인에도 paid 이력 있는 사람
  let firstTime = 0
  let recurring = 0
  if (uniqueMembers.size > 0) {
    const memberIds = [...uniqueMembers]
    const { data: otherPayments } = await supabase
      .from('payments')
      .select('member_id')
      .eq('pay_status', 'paid')
      .neq('campaign_id', campaignId)
      .in('member_id', memberIds)

    const recurringSet = new Set((otherPayments ?? []).map((p) => p.member_id as string))
    for (const mid of memberIds) {
      if (recurringSet.has(mid)) recurring++
      else firstTime++
    }
  }

  const goal = Number(campaign.goal_amount ?? 0)
  const goalPct = goal > 0 ? Math.min(Math.round((raised / goal) * 100), 999) : null

  // G-D83: failed/cancelled/refund 집계
  const { data: nonPaidRaw } = await supabase
    .from('payments')
    .select('pay_status, refund_amount')
    .eq('campaign_id', campaignId)
    .in('pay_status', ['failed', 'cancelled', 'refunded'])

  let failedCount = 0
  let cancelledCount = 0
  let refundCount = 0
  let refundAmount = 0
  for (const r of (nonPaidRaw ?? []) as Array<{
    pay_status: string
    refund_amount: number | null
  }>) {
    if (r.pay_status === 'failed') failedCount++
    else if (r.pay_status === 'cancelled') cancelledCount++
    else if (r.pay_status === 'refunded') {
      refundCount++
      refundAmount += Number(r.refund_amount ?? 0)
    }
  }
  const attempted = paidCount + failedCount + cancelledCount + refundCount
  const failureRatio =
    attempted > 0 ? (failedCount + cancelledCount) / attempted : 0

  return {
    campaign: {
      id: campaign.id as string,
      title: campaign.title as string,
      goal_amount: goal || null,
      status: campaign.status as string,
      started_at: campaign.started_at as string | null,
      ended_at: campaign.ended_at as string | null,
    },
    totals: {
      raised,
      goalPct,
      paidCount,
      uniqueDonors: uniqueMembers.size,
      avgAmount: paidCount > 0 ? Math.round(raised / paidCount) : 0,
      failedCount,
      cancelledCount,
      refundCount,
      refundAmount,
      failureRatio,
    },
    dailyRaised,
    topDonors,
    retentionSplit: { firstTime, recurring },
  }
}
