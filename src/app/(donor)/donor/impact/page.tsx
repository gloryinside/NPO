import { getDonorSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorImpact, getImpactUnitAmount } from '@/lib/donor/impact'
import { getOrgSettingsCached } from '@/lib/org/settings'
import { ImpactDonutChart } from '@/components/donor/impact/ImpactDonutChart'
import { ImpactYearlyBar } from '@/components/donor/impact/ImpactYearlyBar'
import { ImpactMonthlyHeatmap } from '@/components/donor/impact/ImpactMonthlyHeatmap'
import { ImpactShareActions } from '@/components/donor/impact/ImpactShareActions'
import { EmptyState } from '@/components/donor/ui/EmptyState'

function formatKRW(n: number): string {
  if (n >= 100_000_000)
    return `${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}억원`
  if (n >= 10_000)
    return `${Math.floor(n / 10_000).toLocaleString('ko-KR')}만 ${n % 10_000 > 0 ? `${(n % 10_000).toLocaleString('ko-KR')}원` : '원'}`
  return n.toLocaleString('ko-KR') + '원'
}

function formatKRWFull(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDate(iso: string | null): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default async function DonorImpactPage() {
  const session = await getDonorSession()
  if (!session) redirect('/donor/login')
  const { member } = session
  const supabase = createSupabaseAdminClient()

  const impact = await getDonorImpact(supabase, member.org_id, member.id)

  const orgSettings = await getOrgSettingsCached(member.org_id)
  const unitAmount = orgSettings.impact_unit_amount || getImpactUnitAmount()
  const estimatedBeneficiaries = Math.floor(impact.totalAmount / unitAmount)
  const unitLabel =
    unitAmount >= 10_000
      ? `${Math.round(unitAmount / 10_000)}만원`
      : `${unitAmount.toLocaleString('ko-KR')}원`

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
        <EmptyState
          icon="🌱"
          title="아직 후원 내역이 없습니다."
          description="첫 후원으로 변화를 시작해보세요."
          cta={{ href: '/', label: '캠페인 둘러보기' }}
        />
      ) : (
        <>
          {/* ── 히어로 ── */}
          <section
            className="relative overflow-hidden rounded-2xl p-8 text-center"
            style={{
              background:
                'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, var(--surface)) 100%)',
            }}
          >
            {/* 배경 장식 원 */}
            <div
              className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-10"
              style={{ background: '#fff' }}
            />
            <div
              className="pointer-events-none absolute -bottom-8 -left-8 h-32 w-32 rounded-full opacity-10"
              style={{ background: '#fff' }}
            />

            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              나의 임팩트
            </p>
            <p className="mt-3 text-4xl font-extrabold text-white sm:text-5xl">
              {formatKRW(impact.totalAmount)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              ({formatKRWFull(impact.totalAmount)})
            </p>
            <p className="mt-4 text-sm text-white/80">
              {formatDate(impact.firstPayDate)}부터 총{' '}
              <span className="font-semibold text-white">
                {impact.paymentCount}회
              </span>{' '}
              후원
              {impact.activeMonths > 0 && (
                <>
                  {' '}
                  · 함께한{' '}
                  <span className="font-semibold text-white">
                    {impact.activeMonths}개월
                  </span>
                </>
              )}
            </p>
          </section>

          {/* ── 핵심 지표 4개 ── */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon="💰"
              label="누적 후원액"
              value={formatKRW(impact.totalAmount)}
              sub={formatKRWFull(impact.totalAmount)}
              color="var(--accent)"
            />
            <MetricCard
              icon="🔄"
              label="후원 횟수"
              value={`${impact.paymentCount}회`}
              color="var(--positive)"
            />
            <MetricCard
              icon="📅"
              label="함께한 기간"
              value={`${impact.activeMonths}개월`}
              color="var(--info)"
            />
            <MetricCard
              icon="🌱"
              label={`지원 추정 (${unitLabel}당)`}
              value={`${estimatedBeneficiaries.toLocaleString('ko-KR')}건`}
              color="var(--warning)"
            />
          </section>

          {/* ── 캠페인별 분포 ── */}
          {impact.byCampaign.length > 0 && (
            <section>
              <SectionTitle>참여하신 캠페인</SectionTitle>
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <div className="grid gap-6 p-6 md:grid-cols-[1fr_240px]">
                  <ImpactDonutChart
                    data={impact.byCampaign.map((c) => ({
                      title: c.title,
                      amount: c.amount,
                    }))}
                  />
                  <ul className="space-y-1">
                    {impact.byCampaign.map((c) => {
                      const pct = Math.round(
                        (c.amount / impact.totalAmount) * 100
                      )
                      return (
                        <li
                          key={c.campaignId ?? '__none__'}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <span
                            className="truncate text-sm"
                            style={{ color: 'var(--text)' }}
                          >
                            {c.title}
                          </span>
                          <div className="shrink-0 text-right">
                            <p
                              className="text-sm font-semibold"
                              style={{ color: 'var(--accent)' }}
                            >
                              {formatKRWFull(c.amount)}
                            </p>
                            <p
                              className="text-xs"
                              style={{ color: 'var(--muted-foreground)' }}
                            >
                              {c.count}회 · {pct}%
                            </p>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </section>
          )}

          {/* ── 월별 히트맵 ── */}
          {impact.byMonth.length > 0 && (
            <section>
              <SectionTitle>월별 후원 히트맵</SectionTitle>
              <div
                className="overflow-hidden rounded-2xl border p-6"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <ImpactMonthlyHeatmap data={impact.byMonth} />
              </div>
            </section>
          )}

          {/* ── 연도별 추이 ── */}
          {impact.byYear.length >= 2 && (
            <section>
              <SectionTitle>연도별 후원 추이</SectionTitle>
              <div
                className="overflow-hidden rounded-2xl border p-6"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <ImpactYearlyBar
                  data={impact.byYear.map((y) => ({
                    year: y.year,
                    amount: y.amount,
                  }))}
                />
              </div>
            </section>
          )}

          {/* ── 리포트·공유 ── */}
          <ImpactShareActions
            availableYears={impact.byYear.map((y) => y.year).reverse()}
            cacheVersion={impact.lastPayDate}
          />

          {/* ── 연도별 상세 표 ── */}
          {impact.byYear.length > 0 && (
            <section>
              <SectionTitle>연도별 상세</SectionTitle>
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <table className="w-full">
                  <thead
                    style={{
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <tr>
                      {['연도', '금액', '건수'].map((h, i) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                          style={{
                            color: 'var(--muted-foreground)',
                            textAlign: i === 0 ? 'left' : 'right',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...impact.byYear].reverse().map((y) => (
                      <tr
                        key={y.year}
                        style={{ borderBottom: '1px solid var(--border)' }}
                        className="last:border-b-0"
                      >
                        <td
                          className="px-4 py-3 text-sm font-medium"
                          style={{ color: 'var(--text)' }}
                        >
                          {y.year}년
                        </td>
                        <td
                          className="px-4 py-3 text-right text-sm font-bold"
                          style={{ color: 'var(--accent)' }}
                        >
                          {formatKRWFull(y.amount)}
                        </td>
                        <td
                          className="px-4 py-3 text-right text-sm"
                          style={{ color: 'var(--muted-foreground)' }}
                        >
                          {y.count}회
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* ── 공유 CTA ── */}
          <section
            className="rounded-2xl p-8 text-center"
            style={{
              background:
                'linear-gradient(135deg, var(--accent-soft) 0%, var(--surface-2) 100%)',
              border: '1px solid color-mix(in srgb, var(--accent) 20%, transparent)',
            }}
          >
            <p className="text-2xl mb-2">❤️</p>
            <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              당신의 후원이 세상을 바꾸고 있습니다
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              주변에도 알려 더 많은 변화를 함께 만들어요.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a
                href="/donor/invite"
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                🎁 친구 초대하기
              </a>
              <a
                href="/donor"
                className="inline-flex items-center rounded-xl border px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  textDecoration: 'none',
                }}
              >
                ← 마이페이지
              </a>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

/* ── 서브 컴포넌트 ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-4 text-base font-semibold"
      style={{ color: 'var(--text)' }}
    >
      {children}
    </h2>
  )
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string
  label: string
  value: string
  sub?: string
  color: string
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border p-5 text-center"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      <span className="text-2xl">{icon}</span>
      <p
        className="mt-2 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--muted-foreground)' }}
      >
        {label}
      </p>
      <p className="mt-1 text-xl font-extrabold" style={{ color }}>
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--muted-foreground)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
