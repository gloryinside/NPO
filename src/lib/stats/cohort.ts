import type { SupabaseClient } from '@supabase/supabase-js'

export interface CohortRow {
  cohortMonth: string      // 가입월 "YYYY-MM"
  size: number             // 가입자 수
  retention: number[]      // [M1 잔존율, M2, M3, ...] 0~100
}

/**
 * Tier A #6: 가입월 코호트 × N개월 잔존율.
 *
 * 잔존 정의: 코호트 달(M0) 이후 특정 달(Mn)에 해당 회원이 `paid` payment를 1건 이상 가진 경우.
 * `retention[i]` = M(i+1) 기준 잔존율. retention.length === horizonMonths.
 *
 * 시스템 시간(KST) 기준 최근 N개 코호트를 반환 (최신이 배열 첫 위치).
 *
 * 성능: payments/members 각각 한 번만 read.
 */
export async function fetchCohortRetention(
  supabase: SupabaseClient,
  orgId: string,
  cohortCount = 6,
  horizonMonths = 5,
): Promise<CohortRow[]> {
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000)

  // 최근 N개 코호트 시작월 (역순) — kst[0]이 가장 오래된 코호트
  const cohorts: Date[] = []
  for (let i = cohortCount - 1; i >= 0; i--) {
    cohorts.push(new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() - i, 1)))
  }

  const rangeStart = cohorts[0]
  const startStr = `${rangeStart.getUTCFullYear()}-${String(rangeStart.getUTCMonth() + 1).padStart(2, '0')}-01`

  // 기간 내 가입한 회원
  const { data: members } = await supabase
    .from('members')
    .select('id, created_at')
    .eq('org_id', orgId)
    .gte('created_at', startStr)

  if (!members || members.length === 0) {
    return cohorts.map((c) => ({
      cohortMonth: monthKey(c),
      size: 0,
      retention: Array(horizonMonths).fill(0),
    }))
  }

  const memberIds = members.map((m) => m.id as string)
  const memberCohort = new Map<string, string>()
  for (const m of members) {
    const created = new Date(m.created_at as string)
    memberCohort.set(m.id as string, monthKey(created))
  }

  // 코호트 크기
  const cohortSize = new Map<string, number>()
  for (const key of memberCohort.values()) {
    cohortSize.set(key, (cohortSize.get(key) ?? 0) + 1)
  }

  // 이 회원들의 paid payments
  const { data: payments } = await supabase
    .from('payments')
    .select('member_id, pay_date')
    .eq('org_id', orgId)
    .eq('pay_status', 'paid')
    .in('member_id', memberIds)
    .gte('pay_date', startStr)

  // 각 (cohort, month offset)별 retained 멤버 집합
  const retained = new Map<string, Set<string>>()  // key = `${cohortKey}:${offset}`

  for (const p of payments ?? []) {
    const mid = p.member_id as string
    const cohortKey = memberCohort.get(mid)
    if (!cohortKey) continue
    const payMonth = monthKey(new Date(p.pay_date as string))
    const offset = monthsBetween(cohortKey, payMonth)
    if (offset <= 0 || offset > horizonMonths) continue
    const rk = `${cohortKey}:${offset}`
    let set = retained.get(rk)
    if (!set) {
      set = new Set()
      retained.set(rk, set)
    }
    set.add(mid)
  }

  return cohorts.map((c) => {
    const key = monthKey(c)
    const size = cohortSize.get(key) ?? 0
    const retention: number[] = []
    for (let i = 1; i <= horizonMonths; i++) {
      const set = retained.get(`${key}:${i}`)
      const count = set ? set.size : 0
      retention.push(size > 0 ? Math.round((count / size) * 1000) / 10 : 0)
    }
    return { cohortMonth: key, size, retention }
  })
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthsBetween(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}
