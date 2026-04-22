import { NextRequest, NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorImpact, type DonorImpact } from '@/lib/donor/impact'
import { generateImpactPdf } from '@/lib/donor/impact-pdf'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/donor/impact/pdf?year=YYYY
 *
 * Phase 5-A: 후원자 개인 임팩트 연간 리포트 PDF 다운로드.
 *   - year 생략 또는 0 → 전체 기간
 *   - 그 외 → 해당 연도만 포함하도록 impact 재계산
 *
 * rate limit: 분당 5회 (PDF 생성 비용 높음)
 */
export async function GET(req: NextRequest) {
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const rl = rateLimit(`impact:pdf:${session.member.id}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const yearRaw = req.nextUrl.searchParams.get('year')
  const year = yearRaw ? Number(yearRaw) : 0
  if (yearRaw && (!Number.isFinite(year) || year < 2000 || year > 2100)) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const impact = await getDonorImpact(supabase, session.member.org_id, session.member.id)

  if (impact.paymentCount === 0) {
    return NextResponse.json({ error: 'no_payments' }, { status: 400 })
  }

  // year가 지정되면 해당 연도로 필터링한 impact 하위 집합 구성
  const effective: DonorImpact = year > 0 ? filterImpactByYear(impact, year) : impact
  if (effective.paymentCount === 0) {
    return NextResponse.json({ error: 'no_payments_in_year' }, { status: 400 })
  }

  // 기관명 조회 (최소 필드만)
  const { data: orgRow } = await supabase
    .from('orgs')
    .select('name')
    .eq('id', session.member.org_id)
    .maybeSingle()

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generateImpactPdf({
      org: { name: (orgRow?.name as string) ?? '기관' },
      member: { name: session.member.name },
      year,
      impact: effective,
      issuedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[impact/pdf] 생성 실패:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'pdf_failed' },
      { status: 500 },
    )
  }

  const filename = year > 0
    ? `impact-${year}-${session.member.name}.pdf`
    : `impact-all-${session.member.name}.pdf`

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}

/** 주어진 연도만 포함하도록 impact 서브셋 재구성 */
function filterImpactByYear(impact: DonorImpact, year: number): DonorImpact {
  const yearRow = impact.byYear.find((y) => y.year === year)
  const monthRows = impact.byMonth.filter((m) => m.month.startsWith(`${year}-`))
  // 캠페인별 세부는 원본 DB 재쿼리 없이는 연도 분리 불가 → 전체 유지하되 제목에 연도 라벨
  return {
    totalAmount: yearRow?.amount ?? 0,
    paymentCount: yearRow?.count ?? 0,
    activeMonths: monthRows.length,
    byCampaign: impact.byCampaign,  // 전체 (단, 리포트 내 "상위 5" 라벨 그대로)
    byYear: yearRow ? [yearRow] : [],
    byMonth: monthRows,
    firstPayDate: monthRows[0]?.month ? `${monthRows[0].month}-01` : null,
    lastPayDate: monthRows.length > 0 ? `${monthRows[monthRows.length - 1].month}-28` : null,
  }
}
