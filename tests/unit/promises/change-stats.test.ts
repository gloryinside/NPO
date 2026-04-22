import { describe, it, expect, vi } from 'vitest'
import { getPromiseChangeStats } from '@/lib/promises/change-stats'
import type { SupabaseClient } from '@supabase/supabase-js'

function buildSupabase(rows: Array<Record<string, unknown>>) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = ret
  chain.gte = ret
  chain.order = () => Promise.resolve({ data: rows, error: null })
  chain.then = (onFulfilled: (v: unknown) => unknown) =>
    Promise.resolve({ data: rows, error: null }).then(onFulfilled)
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

function row(
  direction: 'up' | 'down' | 'same',
  prev: number,
  next: number,
  createdAt: string,
  extras: Partial<Record<string, unknown>> = {}
) {
  return {
    id: `${direction}-${createdAt}-${prev}-${next}`,
    promise_id: 'p1',
    member_id: 'm1',
    previous_amount: prev,
    new_amount: next,
    direction,
    created_at: createdAt,
    members: { name: '홍길동' },
    promises: { campaigns: { title: '아동교육' } },
    ...extras,
  }
}

describe('getPromiseChangeStats', () => {
  it('빈 결과는 모두 0', async () => {
    const s = buildSupabase([])
    const r = await getPromiseChangeStats(s, 'o1')
    expect(r.totalChanges).toBe(0)
    expect(r.byMonth).toEqual([])
    expect(r.topIncreases).toEqual([])
    expect(r.topDecreases).toEqual([])
  })

  it('월별 버킷: up/down/same 카운트 분리', async () => {
    const s = buildSupabase([
      row('up', 10_000, 20_000, '2026-04-05T00:00:00Z'),
      row('up', 20_000, 30_000, '2026-04-10T00:00:00Z'),
      row('down', 50_000, 30_000, '2026-04-15T00:00:00Z'),
      row('same', 10_000, 10_000, '2026-03-15T00:00:00Z'),
    ])
    const r = await getPromiseChangeStats(s, 'o1')
    expect(r.totalChanges).toBe(4)
    expect(r.totalUp).toBe(2)
    expect(r.totalDown).toBe(1)
    expect(r.totalSame).toBe(1)

    const march = r.byMonth.find((b) => b.month === '2026-03')
    const april = r.byMonth.find((b) => b.month === '2026-04')
    expect(march?.sameCount).toBe(1)
    expect(april?.upCount).toBe(2)
    expect(april?.downCount).toBe(1)

    // 월 정렬 오래된 → 최신
    expect(r.byMonth.map((b) => b.month)).toEqual(['2026-03', '2026-04'])
  })

  it('avgDelta 계산 (up 총합 + down 총합 / 전체)', async () => {
    const s = buildSupabase([
      row('up', 10_000, 30_000, '2026-04-01T00:00:00Z'),
      row('down', 50_000, 20_000, '2026-04-02T00:00:00Z'),
    ])
    const r = await getPromiseChangeStats(s, 'o1')
    const april = r.byMonth.find((b) => b.month === '2026-04')
    expect(april?.avgDelta).toBe(Math.round((20_000 + -30_000) / 2)) // -5000
    expect(april?.totalDeltaUp).toBe(20_000)
    expect(april?.totalDeltaDown).toBe(-30_000)
  })

  it('topIncreases / topDecreases는 |delta| 큰 순', async () => {
    const s = buildSupabase([
      row('up', 10_000, 20_000, '2026-04-01T00:00:00Z'),
      row('up', 10_000, 50_000, '2026-04-02T00:00:00Z'),
      row('up', 10_000, 15_000, '2026-04-03T00:00:00Z'),
      row('down', 50_000, 30_000, '2026-04-04T00:00:00Z'),
      row('down', 100_000, 10_000, '2026-04-05T00:00:00Z'),
    ])
    const r = await getPromiseChangeStats(s, 'o1', { topN: 2 })
    expect(r.topIncreases.map((x) => x.delta)).toEqual([40_000, 10_000])
    expect(r.topDecreases.map((x) => x.delta)).toEqual([-90_000, -20_000])
  })

  it('topN은 1~50 사이로 클램프', async () => {
    const s = buildSupabase(
      Array.from({ length: 3 }, (_, i) =>
        row('up', 1000, 2000 + i, `2026-04-0${i + 1}T00:00:00Z`)
      )
    )
    const r = await getPromiseChangeStats(s, 'o1', { topN: 9999 })
    expect(r.topIncreases.length).toBe(3) // 실제 건수로 제한
  })
})
