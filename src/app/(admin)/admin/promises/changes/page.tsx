import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { requireAdminUser } from '@/lib/auth'
import { requireTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getPromiseChangeStats } from '@/lib/promises/change-stats'
import { PromiseChangeChart } from '@/components/admin/charts/promise-change-chart'

export const dynamic = 'force-dynamic'

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDelta(n: number): string {
  if (n === 0) return '±0원'
  const sign = n > 0 ? '+' : '-'
  return `${sign}${Math.abs(n).toLocaleString('ko-KR')}원`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ko-KR')
  } catch {
    return iso
  }
}

interface SearchParams {
  days?: string
}

/**
 * Phase 6-A / G-105: 약정 금액 변경 추이 대시보드.
 *   - 기간 선택: 30 / 90 / 180일
 *   - 전체 지표 카드 4종 (총 변경, 증액, 감액, 동일)
 *   - 월별 stacked bar
 *   - 증액 / 감액 Top 10 테이블
 */
export default async function PromiseChangesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requireAdminUser()
  const tenant = await requireTenant()
  const supabase = createSupabaseAdminClient()

  const { days: daysRaw } = await searchParams
  const parsed = Number(daysRaw)
  const allowedDays = [30, 90, 180]
  const days = allowedDays.includes(parsed) ? parsed : 180

  const stats = await getPromiseChangeStats(supabase, tenant.id, {
    sinceDays: days,
    topN: 10,
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          약정 금액 변경 추이
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          최근 {days}일간 후원자/관리자가 진행한 약정 금액 변경 현황입니다.
        </p>
      </div>

      {/* 기간 필터 + CSV 내보내기 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-2">
          {allowedDays.map((d) => (
            <a
              key={d}
              href={`/admin/promises/changes?days=${d}`}
              className={`rounded-md border px-3 py-1.5 text-sm transition-opacity hover:opacity-80 ${
                d === days
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--muted-foreground)]'
              }`}
            >
              {d}일
            </a>
          ))}
        </nav>

        {/* G-114: 현재 필터 기간을 그대로 CSV로 다운로드 */}
        <a
          href={`/api/admin/promises/changes/export.csv?days=${days}`}
          className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm text-[var(--text)] hover:border-[var(--accent)]"
          download
        >
          CSV 내보내기
        </a>
      </div>

      {/* 지표 카드 4종 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="총 변경 건수" value={`${stats.totalChanges}건`} />
        <MetricCard
          label="증액"
          value={`${stats.totalUp}건`}
          color="var(--positive)"
        />
        <MetricCard
          label="감액"
          value={`${stats.totalDown}건`}
          color="var(--negative)"
        />
        <MetricCard label="동일" value={`${stats.totalSame}건`} />
      </div>

      {/* 월별 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[var(--text)]">
            월별 변경 건수
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.byMonth.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              해당 기간에 변경이 없습니다.
            </p>
          ) : (
            <PromiseChangeChart
              data={stats.byMonth.map((b) => ({
                month: b.month,
                upCount: b.upCount,
                downCount: b.downCount,
                sameCount: b.sameCount,
              }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Top 증액 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[var(--text)]">
            가장 큰 증액 Top 10
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeTable rows={stats.topIncreases} />
        </CardContent>
      </Card>

      {/* Top 감액 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-[var(--text)]">
            가장 큰 감액 Top 10
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ChangeTable rows={stats.topDecreases} />
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-center">
      <div className="mb-1 text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
        {label}
      </div>
      <div
        className="text-lg font-bold"
        style={{ color: color ?? 'var(--text)' }}
      >
        {value}
      </div>
    </div>
  )
}

function ChangeTable({
  rows,
}: {
  rows: Array<{
    id: string
    memberName: string | null
    campaignTitle: string | null
    previousAmount: number
    newAmount: number
    delta: number
    createdAt: string
  }>
}) {
  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--muted-foreground)]">
        해당하는 변경이 없습니다.
      </p>
    )
  }
  return (
    <div className="overflow-hidden rounded-md border border-[var(--border)]">
      <table className="w-full">
        <thead className="bg-[var(--surface-2)] text-xs uppercase text-[var(--muted-foreground)]">
          <tr>
            <th className="px-3 py-2 text-left">후원자</th>
            <th className="px-3 py-2 text-left">캠페인</th>
            <th className="px-3 py-2 text-right">이전 → 새</th>
            <th className="px-3 py-2 text-right">변동</th>
            <th className="px-3 py-2 text-right">일자</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="border-t border-[var(--border)] text-sm"
            >
              <td className="px-3 py-2 text-[var(--text)]">
                {r.memberName ?? '(알 수 없음)'}
              </td>
              <td className="px-3 py-2 text-[var(--muted-foreground)]">
                {r.campaignTitle ?? '-'}
              </td>
              <td className="px-3 py-2 text-right font-mono text-xs text-[var(--muted-foreground)]">
                {formatKRW(r.previousAmount)} →{' '}
                <span className="text-[var(--text)]">
                  {formatKRW(r.newAmount)}
                </span>
              </td>
              <td
                className="px-3 py-2 text-right font-semibold"
                style={{
                  color:
                    r.delta > 0
                      ? 'var(--positive)'
                      : r.delta < 0
                        ? 'var(--negative)'
                        : 'var(--muted-foreground)',
                }}
              >
                {formatDelta(r.delta)}
              </td>
              <td className="px-3 py-2 text-right text-xs text-[var(--muted-foreground)]">
                {formatDate(r.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
