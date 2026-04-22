import { describe, it, expect, vi } from 'vitest'
import { getDonorImpact } from '@/lib/donor/impact'
import type { SupabaseClient } from '@supabase/supabase-js'

/** getDonorImpact는 Supabase 쿼리 체인을 호출한다 — 체인을 흉내내는 stub 생성 */
function stub(rows: unknown[]) {
  const chain: Record<string, unknown> = {
    select() { return chain },
    eq() { return chain },
    order() { return Promise.resolve({ data: rows, error: null }) },
  }
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

describe('getDonorImpact', () => {
  it('결제 없음 → 모두 0', async () => {
    const r = await getDonorImpact(stub([]), 'org-1', 'm-1')
    expect(r.totalAmount).toBe(0)
    expect(r.paymentCount).toBe(0)
    expect(r.activeMonths).toBe(0)
    expect(r.byCampaign).toEqual([])
    expect(r.byYear).toEqual([])
  })

  it('단일 캠페인 + 2회 결제 집계', async () => {
    const rows = [
      { amount: 10000, pay_date: '2024-01-15', campaign_id: 'c1', campaigns: { id: 'c1', title: '아동교육' } },
      { amount: 30000, pay_date: '2024-06-20', campaign_id: 'c1', campaigns: { id: 'c1', title: '아동교육' } },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.totalAmount).toBe(40000)
    expect(r.paymentCount).toBe(2)
    expect(r.byCampaign).toEqual([
      { campaignId: 'c1', title: '아동교육', amount: 40000, count: 2 },
    ])
    expect(r.byYear).toEqual([{ year: 2024, amount: 40000, count: 2 }])
    expect(r.firstPayDate).toBe('2024-01-15')
    expect(r.lastPayDate).toBe('2024-06-20')
  })

  it('여러 캠페인은 금액 내림차순으로 정렬', async () => {
    const rows = [
      { amount: 5000, pay_date: '2024-01-01', campaign_id: 'c1', campaigns: { id: 'c1', title: 'A' } },
      { amount: 20000, pay_date: '2024-02-01', campaign_id: 'c2', campaigns: { id: 'c2', title: 'B' } },
      { amount: 15000, pay_date: '2024-03-01', campaign_id: 'c3', campaigns: { id: 'c3', title: 'C' } },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.byCampaign.map((c) => c.title)).toEqual(['B', 'C', 'A'])
  })

  it('campaign_id가 null이면 "일반 후원"으로 집계', async () => {
    const rows = [
      { amount: 10000, pay_date: '2024-01-01', campaign_id: null, campaigns: null },
      { amount: 20000, pay_date: '2024-02-01', campaign_id: null, campaigns: null },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.byCampaign).toEqual([
      { campaignId: null, title: '일반 후원', amount: 30000, count: 2 },
    ])
  })

  it('연도별 집계는 연도 오름차순', async () => {
    const rows = [
      { amount: 10000, pay_date: '2023-12-01', campaign_id: null, campaigns: null },
      { amount: 20000, pay_date: '2024-01-01', campaign_id: null, campaigns: null },
      { amount: 30000, pay_date: '2025-03-01', campaign_id: null, campaigns: null },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.byYear).toEqual([
      { year: 2023, amount: 10000, count: 1 },
      { year: 2024, amount: 20000, count: 1 },
      { year: 2025, amount: 30000, count: 1 },
    ])
  })

  it('Phase 5-A: byMonth는 YYYY-MM 키로 월별 집계', async () => {
    const rows = [
      { amount: 10000, pay_date: '2024-01-15', campaign_id: null, campaigns: null },
      { amount: 20000, pay_date: '2024-01-28', campaign_id: null, campaigns: null },
      { amount: 30000, pay_date: '2024-03-10', campaign_id: null, campaigns: null },
      { amount: 5000, pay_date: '2025-02-05', campaign_id: null, campaigns: null },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.byMonth).toEqual([
      { month: '2024-01', amount: 30000, count: 2 },
      { month: '2024-03', amount: 30000, count: 1 },
      { month: '2025-02', amount: 5000, count: 1 },
    ])
  })

  it('G-83: 7개 이상 캠페인은 상위 5 + "기타"로 묶인다', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      amount: (8 - i) * 10000,  // 내림차순
      pay_date: `2024-0${(i % 9) + 1}-01`,
      campaign_id: `c${i}`,
      campaigns: { id: `c${i}`, title: `캠페인${i}` },
    }))
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.byCampaign.length).toBe(6)  // keep=6, 상위 5 + 기타 1
    expect(r.byCampaign[5].campaignId).toBe(null)
    expect(r.byCampaign[5].title).toMatch(/^기타/)
    // 합계는 원본 총액과 동일해야 함 (8+7+6+5+4+3+2+1)*10000 = 360000
    const total = r.byCampaign.reduce((s, c) => s + c.amount, 0)
    expect(total).toBe(360000)
  })

  it('activeMonths는 첫 결제 월부터 마지막 결제 월까지의 개월 수', async () => {
    const rows = [
      { amount: 10000, pay_date: '2024-01-15', campaign_id: null, campaigns: null },
      { amount: 10000, pay_date: '2024-06-15', campaign_id: null, campaigns: null },
    ]
    const r = await getDonorImpact(stub(rows), 'org-1', 'm-1')
    expect(r.activeMonths).toBe(6)  // 1월~6월 = 6개월
  })
})
