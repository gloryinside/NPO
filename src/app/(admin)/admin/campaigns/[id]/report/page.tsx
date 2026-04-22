import { requireAdminUser } from '@/lib/auth'
import { requireTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getCampaignReport } from '@/lib/campaigns/report'
import { ReportDailyChart } from '@/components/admin/campaign-report/ReportDailyChart'
import { notFound } from 'next/navigation'

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('ko-KR') } catch { return iso }
}

export default async function CampaignReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireAdminUser()
  const tenant = await requireTenant()
  const { id } = await params
  const supabase = createSupabaseAdminClient()

  // tenant isolation 확인
  const { data: tenantCheck } = await supabase
    .from('campaigns')
    .select('org_id')
    .eq('id', id)
    .maybeSingle()
  if (!tenantCheck || tenantCheck.org_id !== tenant.id) notFound()

  const report = await getCampaignReport(supabase, id)
  if (!report) notFound()

  const { campaign, totals, dailyRaised, topDonors, retentionSplit } = report
  const totalDonorsInSplit = retentionSplit.firstTime + retentionSplit.recurring
  const recurringPct = totalDonorsInSplit > 0
    ? Math.round((retentionSplit.recurring / totalDonorsInSplit) * 100)
    : 0

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <a href={`/admin/campaigns`} className="text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)]">
          ← 캠페인 목록
        </a>
        <h1 className="text-2xl font-bold text-[var(--text)] mt-2">
          {campaign.title} · 종료 리포트
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {formatDate(campaign.started_at)} ~ {formatDate(campaign.ended_at)}
          <span className="ml-2 px-2 py-0.5 rounded bg-[var(--surface-2)] text-[10px]">
            {campaign.status}
          </span>
        </p>
      </div>

      {/* 4대 지표 */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="총 모금액" value={formatKRW(totals.raised)} color="var(--accent)" />
        <MetricCard
          label="목표 달성률"
          value={totals.goalPct !== null ? `${totals.goalPct}%` : '—'}
          sub={campaign.goal_amount ? `목표 ${formatKRW(campaign.goal_amount)}` : '목표 없음'}
          color="var(--positive)"
        />
        <MetricCard label="결제 건수" value={`${totals.paidCount}건`} sub={`평균 ${formatKRW(totals.avgAmount)}`} color="var(--info)" />
        <MetricCard label="고유 후원자" value={`${totals.uniqueDonors}명`} color="var(--warning)" />
      </section>

      {/* 일별 추이 */}
      <section>
        <h2 className="text-lg font-semibold text-[var(--text)] mb-4">일별 모금 추이 (일별 + 누적)</h2>
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
          <ReportDailyChart data={dailyRaised} />
        </div>
      </section>

      {/* 후원자 retention */}
      {totalDonorsInSplit > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)] mb-4">후원자 구성</h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="flex items-center gap-6 mb-4">
              <div>
                <div className="text-xs text-[var(--muted-foreground)] mb-1">재참여</div>
                <div className="text-2xl font-bold text-[var(--accent)]">{retentionSplit.recurring}명</div>
                <div className="text-xs text-[var(--muted-foreground)]">{recurringPct}%</div>
              </div>
              <div>
                <div className="text-xs text-[var(--muted-foreground)] mb-1">신규</div>
                <div className="text-2xl font-bold text-[var(--info)]">{retentionSplit.firstTime}명</div>
                <div className="text-xs text-[var(--muted-foreground)]">{100 - recurringPct}%</div>
              </div>
            </div>
            <div className="h-3 rounded-full overflow-hidden bg-[var(--surface-2)] flex">
              <div style={{ width: `${recurringPct}%`, background: 'var(--accent)' }} />
              <div style={{ width: `${100 - recurringPct}%`, background: 'var(--info)' }} />
            </div>
            <p className="text-xs text-[var(--muted-foreground)] mt-3">
              재참여 = 이 캠페인 외 다른 캠페인에도 paid 결제 이력이 있는 후원자
            </p>
          </div>
        </section>
      )}

      {/* 상위 후원자 */}
      {topDonors.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[var(--text)] mb-4">상위 후원자 (Top 10)</h2>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <table className="w-full">
              <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">순위</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">후원자</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">금액</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">건수</th>
                </tr>
              </thead>
              <tbody>
                {topDonors.map((d, i) => (
                  <tr key={i} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--muted-foreground)]">{i + 1}</td>
                    <td className="px-4 py-3 text-sm text-[var(--text)]">{d.memberName}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--accent)]">{formatKRW(d.amount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-[var(--muted-foreground)]">{d.count}회</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 다음 액션 */}
      <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-6">
        <p className="text-sm text-[var(--text)] mb-4">이 리포트는 캠페인 관리자만 볼 수 있습니다.</p>
        <div className="flex flex-wrap gap-2">
          <a href={`/admin/campaigns/${id}/edit`} className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80">
            캠페인 편집
          </a>
          <a href="/admin/stats" className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90">
            전체 통계 →
          </a>
        </div>
      </section>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-2">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-[var(--muted-foreground)] mt-1">{sub}</div>}
    </div>
  )
}
