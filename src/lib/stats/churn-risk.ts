import type { SupabaseClient } from '@supabase/supabase-js'

export interface ChurnRiskMember {
  memberId: string
  memberName: string
  memberPhone: string | null
  memberEmail: string | null
  unpaidCount: number
  lastPayDate: string | null
  totalUnpaid: number
}

/**
 * 이탈 위험 후원자 조회.
 *
 * 정의: 최근 6개월 내 `pay_status in (failed, unpaid)` 결제가 2회 이상.
 * 반환은 `unpaidCount` 내림차순, 같으면 최근 미납일 내림차순.
 *
 * `/admin/stats` 페이지와 `cron/notify-churn-risk`에서 공용으로 사용.
 */
export async function fetchChurnRiskMembers(
  supabase: SupabaseClient,
  orgId: string,
): Promise<ChurnRiskMember[]> {
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const startStr = `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, '0')}-01`

  const { data } = await supabase
    .from('payments')
    .select('member_id, pay_date, pay_status, amount, members(name, phone, email)')
    .eq('org_id', orgId)
    .in('pay_status', ['failed', 'unpaid'])
    .gte('pay_date', startStr)

  const map = new Map<string, ChurnRiskMember>()
  for (const row of data ?? []) {
    const mid = row.member_id as string | null
    if (!mid) continue
    const member = (row as Record<string, unknown>).members as
      | { name: string; phone: string | null; email: string | null }
      | null
    const cur = map.get(mid) ?? {
      memberId: mid,
      memberName: member?.name ?? '알 수 없음',
      memberPhone: member?.phone ?? null,
      memberEmail: member?.email ?? null,
      unpaidCount: 0,
      lastPayDate: null,
      totalUnpaid: 0,
    }
    cur.unpaidCount += 1
    cur.totalUnpaid += Number(row.amount ?? 0)
    if (!cur.lastPayDate || (row.pay_date as string) > cur.lastPayDate) {
      cur.lastPayDate = row.pay_date as string
    }
    map.set(mid, cur)
  }

  return Array.from(map.values())
    .filter((m) => m.unpaidCount >= 2)
    .sort(
      (a, b) =>
        b.unpaidCount - a.unpaidCount ||
        (b.lastPayDate ?? '').localeCompare(a.lastPayDate ?? ''),
    )
}
