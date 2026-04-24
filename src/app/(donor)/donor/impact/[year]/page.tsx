import { getDonorSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorImpact } from '@/lib/donor/impact'
import { ImpactDonutChart } from '@/components/donor/impact/ImpactDonutChart'
import { ImpactMonthlyHeatmap } from '@/components/donor/impact/ImpactMonthlyHeatmap'
import { YearSelector } from '@/components/donor/impact/year-selector'
import type { Metadata } from 'next'

const MIN_YEAR = 2015

function formatKRW(n: number): string {
  if (n >= 100_000_000)
    return `${(n / 100_000_000).toFixed(n % 100_000_000 === 0 ? 0 : 1)}억원`
  if (n >= 10_000) return `${Math.floor(n / 10_000).toLocaleString('ko-KR')}만원`
  return n.toLocaleString('ko-KR') + '원'
}

type RouteParams = { year: string }

function parseYear(raw: string): number | null {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return null
  const currentYear = new Date().getUTCFullYear()
  if (n < MIN_YEAR || n > currentYear) return null
  return n
}

export async function generateMetadata(
  { params }: { params: Promise<RouteParams> },
): Promise<Metadata> {
  const { year } = await params
  const y = parseYear(year)
  if (!y) return { title: '임팩트' }
  return {
    title: `${y}년 나의 임팩트`,
    openGraph: {
      title: `${y}년 나의 후원 임팩트`,
      images: [
        {
          url: `/api/donor/impact/og?year=${y}`,
          width: 1200,
          height: 630,
        },
      ],
    },
  }
}

export default async function ImpactYearPage({
  params,
}: {
  params: Promise<RouteParams>
}) {
  const { year: yearRaw } = await params
  const yearNum = parseYear(yearRaw)
  if (!yearNum) notFound()

  const session = await getDonorSession()
  if (!session) redirect('/donor/login')
  const { member } = session
  const supabase = createSupabaseAdminClient()

  const impact = await getDonorImpact(
    supabase,
    member.org_id,
    member.id,
    yearNum,
  )
  const currentYear = new Date().getUTCFullYear()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ color: 'var(--text)' }}
          >
            {yearNum}년 나의 임팩트
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            {yearNum}년 한 해 동안의 후원 활동을 정리했습니다.
          </p>
        </div>
        <YearSelector currentYear={currentYear} selectedYear={yearNum} />
      </div>

      {impact.paymentCount === 0 ? (
        <div
          className="rounded-2xl p-12 text-center"
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
          }}
        >
          <p className="text-4xl mb-3" aria-hidden="true">
            🌱
          </p>
          <p
            className="text-base font-semibold"
            style={{ color: 'var(--text)' }}
          >
            {yearNum}년에는 후원 내역이 없습니다.
          </p>
          <a
            href="/donor/impact"
            className="mt-4 inline-block text-sm font-medium"
            style={{ color: 'var(--accent)', textDecoration: 'none' }}
          >
            ← 전체 임팩트로 돌아가기
          </a>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <section
            className="rounded-2xl p-6"
            style={{
              background:
                'linear-gradient(135deg, var(--accent) 0%, color-mix(in srgb, var(--accent) 60%, var(--surface)) 100%)',
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-white/70">
              {yearNum}년 총 후원
            </p>
            <p className="mt-2 text-3xl font-extrabold text-white sm:text-4xl">
              {formatKRW(impact.totalAmount)}
            </p>
            <p className="mt-1 text-sm text-white/80">
              {impact.paymentCount}회 · 평균{' '}
              {formatKRW(Math.round(impact.totalAmount / impact.paymentCount))}
            </p>
          </section>

          {/* 월별 히트맵 */}
          {impact.byMonth.length > 0 && (
            <section>
              <h2
                className="mb-3 text-base font-semibold"
                style={{ color: 'var(--text)' }}
              >
                월별 후원
              </h2>
              <ImpactMonthlyHeatmap data={impact.byMonth} />
            </section>
          )}

          {/* 캠페인별 기여 */}
          {impact.byCampaign.length > 0 && (
            <section>
              <h2
                className="mb-3 text-base font-semibold"
                style={{ color: 'var(--text)' }}
              >
                캠페인별 기여
              </h2>
              <ImpactDonutChart
                data={impact.byCampaign.map((c) => ({
                  title: c.title,
                  amount: c.amount,
                }))}
              />
            </section>
          )}

          <div className="pt-4">
            <a
              href="/donor/impact"
              className="text-sm font-medium"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              ← 전체 임팩트로 돌아가기
            </a>
          </div>
        </>
      )}
    </div>
  )
}
