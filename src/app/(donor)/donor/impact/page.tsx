import { getDonorSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorImpact, getImpactUnitAmount } from '@/lib/donor/impact'
import { getOrgSettingsCached } from '@/lib/org/settings'
import { ImpactDonutChart } from '@/components/donor/impact/ImpactDonutChart'
import { ImpactYearlyBar } from '@/components/donor/impact/ImpactYearlyBar'

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try { return new Date(iso).toLocaleDateString('ko-KR') } catch { return iso }
}

export default async function DonorImpactPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')
  const { member } = session
  const supabase = createSupabaseAdminClient()

  const impact = await getDonorImpact(supabase, member.org_id, member.id)

  // G-82 + Phase 4-B: 기관 설정에 impact_unit_amount 있으면 우선 사용, 없으면 환경변수 기반 fallback
  const orgSettings = await getOrgSettingsCached(member.org_id)
  const unitAmount = orgSettings.impact_unit_amount || getImpactUnitAmount()
  const estimatedBeneficiaries = Math.floor(impact.totalAmount / unitAmount)
  const unitLabel = unitAmount >= 10_000
    ? `${Math.round(unitAmount / 10_000)}만원 단위`
    : `${unitAmount.toLocaleString('ko-KR')}원 단위`

  return (
    <div className="space-y-8">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-[var(--text)]">
          {member.name}님의 임팩트
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          지금까지의 후원이 만들어낸 변화를 확인하세요.
        </p>
      </div>

      {impact.paymentCount === 0 ? (
        // 빈 상태
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
          <p className="text-5xl mb-3">🌱</p>
          <p className="text-sm text-[var(--text)]">아직 후원 내역이 없습니다.</p>
          <p className="text-xs mt-2 text-[var(--muted-foreground)]">
            첫 후원으로 변화를 시작해보세요.
          </p>
          <a href="/" className="mt-6 inline-block rounded-lg px-6 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90">
            캠페인 둘러보기 →
          </a>
        </div>
      ) : (
        <>
          {/* 히어로 지표 — 당신의 N만원이 한 일 */}
          <section className="rounded-xl border border-[var(--accent)]/30 p-8 text-center"
            style={{ background: 'linear-gradient(135deg, var(--accent-soft), var(--surface))' }}>
            <p className="text-xs font-semibold text-[var(--accent)] uppercase tracking-wider mb-3">당신의 임팩트</p>
            <h2 className="text-3xl md:text-4xl font-bold text-[var(--text)] mb-4">
              지금까지 <span className="text-[var(--accent)]">{formatKRW(impact.totalAmount)}</span>을<br/>
              후원해주셨습니다
            </h2>
            <p className="text-sm text-[var(--muted-foreground)]">
              {formatDate(impact.firstPayDate)}부터 총 {impact.paymentCount}회 후원
              {impact.activeMonths > 0 && ` · ${impact.activeMonths}개월 함께`}
            </p>
          </section>

          {/* 핵심 지표 3대 */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard icon="💰" label="누적 후원액" value={formatKRW(impact.totalAmount)} color="var(--accent)" />
            <MetricCard icon="📊" label="후원 건수" value={`${impact.paymentCount}회`} color="var(--positive)" />
            <MetricCard icon="📅" label="함께한 개월" value={`${impact.activeMonths}개월`} color="var(--info)" />
            <MetricCard icon="🌱" label={`지원 추정 (${unitLabel})`} value={`${estimatedBeneficiaries}건`} color="var(--warning)" />
          </section>

          {/* 캠페인별 분포 */}
          {impact.byCampaign.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4">참여하신 캠페인</h2>
              <div className="grid md:grid-cols-[1fr_auto] gap-6 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <ImpactDonutChart data={impact.byCampaign.map((c) => ({ title: c.title, amount: c.amount }))} />
                <ul className="space-y-2">
                  {impact.byCampaign.map((c) => {
                    const pct = Math.round((c.amount / impact.totalAmount) * 100)
                    return (
                      <li key={c.campaignId ?? '__none__'} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--border)] last:border-b-0">
                        <span className="text-sm text-[var(--text)] truncate max-w-[200px]">{c.title}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-[var(--text)]">{formatKRW(c.amount)}</div>
                          <div className="text-xs text-[var(--muted-foreground)]">{c.count}회 · {pct}%</div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            </section>
          )}

          {/* 연도별 추이 (2년 이상일 때만) */}
          {impact.byYear.length >= 2 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4">연도별 후원 추이</h2>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-6">
                <ImpactYearlyBar data={impact.byYear.map((y) => ({ year: y.year, amount: y.amount }))} />
              </div>
            </section>
          )}

          {/* 연도별 상세 표 */}
          {impact.byYear.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-4">연도별 상세</h2>
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
                <table className="w-full">
                  <thead className="bg-[var(--surface-2)] border-b border-[var(--border)]">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">연도</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">금액</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">건수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...impact.byYear].reverse().map((y) => (
                      <tr key={y.year} className="border-b border-[var(--border)] last:border-b-0">
                        <td className="px-4 py-3 text-sm font-medium text-[var(--text)]">{y.year}년</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-[var(--accent)]">{formatKRW(y.amount)}</td>
                        <td className="px-4 py-3 text-right text-sm text-[var(--muted-foreground)]">{y.count}회</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* 공유 CTA */}
          <section className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-6 text-center">
            <p className="text-sm text-[var(--text)] mb-4">
              당신의 후원이 세상을 바꾸고 있습니다. 주변에도 알려주세요.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <a href="/donor" className="inline-flex items-center rounded-md border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm text-[var(--text)] hover:opacity-80">
                ← 마이페이지
              </a>
              <a href="/" className="inline-flex items-center rounded-md px-4 py-2 text-sm font-semibold text-white bg-[var(--accent)] hover:opacity-90">
                다른 캠페인 보기 →
              </a>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-5 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)] mb-1">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  )
}
