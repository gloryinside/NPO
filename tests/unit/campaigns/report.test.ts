import { describe, it, expect, vi } from 'vitest'
import { getCampaignReport } from '@/lib/campaigns/report'
import type { SupabaseClient } from '@supabase/supabase-js'

interface ChainCall {
  table: 'campaigns' | 'payments'
  filters: Record<string, unknown>
  data: unknown
}

/**
 * getCampaignReport의 각 쿼리를 호출 순서대로 응답.
 * thenable 체인: 모든 메서드가 chain을 반환하면서 동시에 Promise처럼 then()도 제공.
 * 첫 번째 terminal(.order / .maybeSingle / .then) 호출 시 다음 response 소비.
 */
function stub(sequence: Array<{ data: unknown }>) {
  let idx = 0
  function makeChain() {
    const result = () => sequence[idx++] ?? { data: null }
    const chain: Record<string, unknown> = {}
    const returnChain = () => chain
    chain.select = returnChain
    chain.eq = returnChain
    chain.neq = returnChain
    chain.in = returnChain
    chain.order = () => Promise.resolve(result())
    chain.maybeSingle = () => Promise.resolve(result())
    // await chain 시 즉시 resolve (in()으로 끝나는 쿼리 대응)
    chain.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result()).then(onFulfilled)
    return chain
  }
  return {
    from: vi.fn().mockImplementation(() => makeChain()),
  } as unknown as SupabaseClient
}

describe('getCampaignReport', () => {
  it('campaign이 없으면 null', async () => {
    const s = stub([{ data: null }])
    const r = await getCampaignReport(s, 'c-missing')
    expect(r).toBeNull()
  })

  it('기본 집계: 모금액/건수/고유후원자', async () => {
    const campaign = {
      id: 'c1', title: '테스트', goal_amount: 100_000, status: 'closed',
      started_at: '2024-01-01', ended_at: '2024-12-31', org_id: 'org-1',
    }
    const payments = [
      { amount: 30_000, pay_date: '2024-03-15', member_id: 'm1', members: { name: 'A' } },
      { amount: 50_000, pay_date: '2024-03-16', member_id: 'm2', members: { name: 'B' } },
      { amount: 40_000, pay_date: '2024-04-10', member_id: 'm1', members: { name: 'A' } },
    ]
    const otherPayments = [
      { member_id: 'm1' },  // m1은 다른 캠페인에도 결제 → recurring
    ]
    const s = stub([
      { data: campaign },
      { data: payments },
      { data: otherPayments },
    ])

    const r = await getCampaignReport(s, 'c1')
    expect(r).not.toBeNull()
    expect(r!.totals.raised).toBe(120_000)
    expect(r!.totals.paidCount).toBe(3)
    expect(r!.totals.uniqueDonors).toBe(2)
    expect(r!.totals.avgAmount).toBe(Math.round(120_000 / 3))
    expect(r!.totals.goalPct).toBe(120)  // 120000/100000 = 120%
    expect(r!.topDonors).toHaveLength(2)
    // A: 30000 + 40000 = 70000, B: 50000 → A가 1위
    expect(r!.topDonors[0].memberName).toBe('A')
    expect(r!.topDonors[0].amount).toBe(70_000)
    expect(r!.retentionSplit.recurring).toBe(1)
    expect(r!.retentionSplit.firstTime).toBe(1)
    expect(r!.dailyRaised.length).toBeGreaterThan(0)
  })

  it('목표 없으면 goalPct는 null', async () => {
    const campaign = {
      id: 'c1', title: '테스트', goal_amount: null, status: 'closed',
      started_at: null, ended_at: null, org_id: 'org-1',
    }
    const s = stub([
      { data: campaign },
      { data: [] },
    ])
    const r = await getCampaignReport(s, 'c1')
    expect(r!.totals.goalPct).toBeNull()
  })

  it('빈 payments → 모두 0', async () => {
    const campaign = {
      id: 'c1', title: 'x', goal_amount: 1000, status: 'active',
      started_at: null, ended_at: null, org_id: 'org-1',
    }
    const s = stub([
      { data: campaign },
      { data: [] },
    ])
    const r = await getCampaignReport(s, 'c1')
    expect(r!.totals.raised).toBe(0)
    expect(r!.totals.paidCount).toBe(0)
    expect(r!.totals.uniqueDonors).toBe(0)
    expect(r!.topDonors).toEqual([])
    expect(r!.dailyRaised).toEqual([])
  })
})
