import { getDonorSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getT } from '@/lib/i18n/donor'
import { getDonorImpact, getImpactUnitAmount } from '@/lib/donor/impact'
import { getOrgSettingsCached } from '@/lib/org/settings'
import { ImpactDonutChart } from '@/components/donor/impact/ImpactDonutChart'
import { ImpactYearlyBar } from '@/components/donor/impact/ImpactYearlyBar'
import { ImpactMonthlyHeatmap } from '@/components/donor/impact/ImpactMonthlyHeatmap'
import { ImpactShareActions } from '@/components/donor/impact/ImpactShareActions'
import { EmptyState } from '@/components/donor/ui/EmptyState'
import { YearSelector } from '@/components/donor/impact/year-selector'

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
  const t = await getT()
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            {t("donor.impact.title", { name: member.name })}
          </h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            {t("donor.impact.subtitle")}
          </p>
        </div>
        {impact.byYear.length > 0 && (
          <YearSelector
            currentYear={new Date().getUTCFullYear()}
            selectedYear={new Date().getUTCFullYear()}
            availableYears={[
              new Date().getUTCFullYear(),
              ...impact.byYear.map((y) => y.year),
            ]}
          />
        )}
      </div>

      {impact.paymentCount === 0 ? (
        <EmptyState
          icon="🌱"
          title={t("donor.impact.empty.title")}
          description={t("donor.impact.empty.body")}
          cta={{ href: '/', label: t("donor.impact.empty.cta") }}
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
              {t("donor.impact.hero.label")}
            </p>
            <p className="mt-3 text-4xl font-extrabold text-white sm:text-5xl">
              {formatKRW(impact.totalAmount)}
            </p>
            <p className="mt-1 text-sm text-white/70">
              ({formatKRWFull(impact.totalAmount)})
            </p>
            <p className="mt-4 text-sm text-white/80">
              {t("donor.impact.hero.since", { date: formatDate(impact.firstPayDate), count: impact.paymentCount })}
              {impact.activeMonths > 0 && (
                <>
                  {' '}
                  · {t("donor.impact.hero.months", { months: impact.activeMonths })}
                </>
              )}
            </p>
          </section>

          {/* ── 핵심 지표 4개 ── */}
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricCard
              icon="💰"
              label={t("donor.impact.metric.total_amount")}
              value={formatKRW(impact.totalAmount)}
              sub={formatKRWFull(impact.totalAmount)}
              color="var(--accent)"
            />
            <MetricCard
              icon="🔄"
              label={t("donor.impact.metric.payment_count")}
              value={t("donor.impact.metric.count_unit", { count: impact.paymentCount })}
              color="var(--positive)"
            />
            <MetricCard
              icon="📅"
              label={t("donor.impact.metric.active_months")}
              value={t("donor.impact.metric.months_unit", { months: impact.activeMonths })}
              color="var(--info)"
            />
            <MetricCard
              icon="🌱"
              label={t("donor.impact.metric.beneficiaries", { unit: unitLabel })}
              value={t("donor.impact.metric.count_unit", { count: estimatedBeneficiaries.toLocaleString('ko-KR') })}
              color="var(--warning)"
            />
          </section>

          {/* ── 캠페인별 분포 ── */}
          {impact.byCampaign.length > 0 && (
            <section>
              <SectionTitle>{t("donor.impact.section.campaigns")}</SectionTitle>
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
                      // G-D51: 평균 금액 표시
                      const avg =
                        c.count > 0 ? Math.round(c.amount / c.count) : 0
                      return (
                        <li
                          key={c.campaignId ?? '__none__'}
                          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
                          style={{ background: 'var(--surface-2)' }}
                        >
                          <div className="min-w-0 flex-1">
                            <p
                              className="truncate text-sm"
                              style={{ color: 'var(--text)' }}
                            >
                              {c.title}
                            </p>
                            {avg > 0 && (
                              <p
                                className="text-xs"
                                style={{ color: 'var(--muted-foreground)' }}
                              >
                                {t("donor.impact.campaign.avg_per_payment", { amount: formatKRWFull(avg) })}
                              </p>
                            )}
                          </div>
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
                              {t("donor.impact.campaign.count_pct", { count: c.count, pct })}
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
              <SectionTitle>{t("donor.impact.section.heatmap")}</SectionTitle>
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
              <SectionTitle>{t("donor.impact.section.yearly_trend")}</SectionTitle>
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
              <SectionTitle>{t("donor.impact.section.yearly_detail")}</SectionTitle>
              <div
                className="overflow-hidden rounded-2xl border"
                style={{
                  borderColor: 'var(--border)',
                  background: 'var(--surface)',
                }}
              >
                <table className="w-full">
                  <caption className="sr-only">{t("donor.impact.section.yearly_detail")}</caption>
                  <thead
                    style={{
                      background: 'var(--surface-2)',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <tr>
                      {[t("donor.impact.table.year"), t("donor.impact.table.amount"), t("donor.impact.table.count")].map((h, i) => (
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
                          {t("donor.impact.table.year_value", { year: y.year })}
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
                          {t("donor.impact.metric.count_unit", { count: y.count })}
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
            <p className="text-2xl mb-2" aria-hidden="true">❤️</p>
            <p className="text-base font-semibold" style={{ color: 'var(--text)' }}>
              {t("donor.impact.cta.title")}
            </p>
            <p
              className="mt-1 text-sm"
              style={{ color: 'var(--muted-foreground)' }}
            >
              {t("donor.impact.cta.body")}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <a
                href="/donor/invite"
                className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                <span aria-hidden="true">🎁</span> {t("donor.impact.invite")}
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
                {t("donor.impact.back")}
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
      <span className="text-2xl" aria-hidden="true">{icon}</span>
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
