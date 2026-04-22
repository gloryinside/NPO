import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 6-A / G-105: 약정 변경 이력(promise_amount_changes) 집계 lib.
 *
 * 관리자 대시보드에서 조직 단위로 업/다운 추이를 볼 수 있게
 * 월별 카운트/평균 증감액 + 가장 큰 변동 Top N을 계산한다.
 *
 * 설계 노트: 실 집계는 SQL (GROUP BY to_char(created_at, 'YYYY-MM'))으로
 * 내리는 게 성능상 이상적이지만, 현재 변경량이 많지 않아 앱 레벨 집계로
 * 단순화. 수만 건 넘어가면 SQL view + materialized view 검토.
 */

export interface MonthlyChangeBucket {
  month: string // 'YYYY-MM'
  upCount: number
  downCount: number
  sameCount: number
  avgDelta: number // (new - prev)의 평균, 원 단위, 정수로 반올림
  totalDeltaUp: number
  totalDeltaDown: number
}

export interface TopChangeRow {
  id: string
  promiseId: string
  memberId: string
  memberName: string | null
  previousAmount: number
  newAmount: number
  delta: number
  direction: 'up' | 'down' | 'same'
  createdAt: string
  campaignTitle: string | null
}

export interface ChangeStatsResult {
  totalChanges: number
  totalUp: number
  totalDown: number
  totalSame: number
  byMonth: MonthlyChangeBucket[] // 오래된 월 → 최신 월
  topIncreases: TopChangeRow[] // 증액 Top N
  topDecreases: TopChangeRow[] // 감액 Top N
}

interface RawRow {
  id: string
  promise_id: string
  member_id: string
  previous_amount: number
  new_amount: number
  direction: 'up' | 'down' | 'same'
  created_at: string
  members: { name: string | null } | null
  promises: { campaigns: { title: string | null } | null } | null
}

export async function getPromiseChangeStats(
  supabase: SupabaseClient,
  orgId: string,
  opts?: {
    sinceDays?: number
    topN?: number
  }
): Promise<ChangeStatsResult> {
  const sinceDays = opts?.sinceDays ?? 180 // 기본 6개월
  const topN = Math.min(Math.max(1, opts?.topN ?? 10), 50)
  const sinceIso = new Date(
    Date.now() - sinceDays * 24 * 60 * 60 * 1000
  ).toISOString()

  const { data } = await supabase
    .from('promise_amount_changes')
    .select(
      'id, promise_id, member_id, previous_amount, new_amount, direction, created_at, members(name), promises(campaigns(title))'
    )
    .eq('org_id', orgId)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })

  const rows = ((data ?? []) as unknown as RawRow[]).map((r) => ({
    id: r.id,
    promiseId: r.promise_id,
    memberId: r.member_id,
    memberName: r.members?.name ?? null,
    previousAmount: Number(r.previous_amount),
    newAmount: Number(r.new_amount),
    delta: Number(r.new_amount) - Number(r.previous_amount),
    direction: r.direction,
    createdAt: r.created_at,
    campaignTitle: r.promises?.campaigns?.title ?? null,
  }))

  // 월별 집계
  const buckets = new Map<string, MonthlyChangeBucket>()
  for (const r of rows) {
    const month = r.createdAt.slice(0, 7) // YYYY-MM
    let b = buckets.get(month)
    if (!b) {
      b = {
        month,
        upCount: 0,
        downCount: 0,
        sameCount: 0,
        avgDelta: 0,
        totalDeltaUp: 0,
        totalDeltaDown: 0,
      }
      buckets.set(month, b)
    }
    if (r.direction === 'up') {
      b.upCount += 1
      b.totalDeltaUp += r.delta
    } else if (r.direction === 'down') {
      b.downCount += 1
      b.totalDeltaDown += r.delta
    } else {
      b.sameCount += 1
    }
  }

  // avgDelta 계산 (전체 건수 기준, same은 0 기여)
  for (const b of buckets.values()) {
    const total = b.upCount + b.downCount + b.sameCount
    b.avgDelta =
      total > 0 ? Math.round((b.totalDeltaUp + b.totalDeltaDown) / total) : 0
  }

  const byMonth = [...buckets.values()].sort((a, b) =>
    a.month < b.month ? -1 : a.month > b.month ? 1 : 0
  )

  const sortedByDelta = [...rows].sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta)
  )
  const topIncreases = sortedByDelta
    .filter((r) => r.direction === 'up')
    .slice(0, topN)
  const topDecreases = sortedByDelta
    .filter((r) => r.direction === 'down')
    .slice(0, topN)

  return {
    totalChanges: rows.length,
    totalUp: rows.filter((r) => r.direction === 'up').length,
    totalDown: rows.filter((r) => r.direction === 'down').length,
    totalSame: rows.filter((r) => r.direction === 'same').length,
    byMonth,
    topIncreases,
    topDecreases,
  }
}
