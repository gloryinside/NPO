/**
 * GET /api/admin/finance/yearly-summary?year=YYYY
 *
 * G-79: financials 섹션 에디터의 "자동 계산" 버튼이 호출하는 참고용 API.
 * 지정 연도의 `payments` 테이블에서 `status='paid'` 행의 amount 합계를 반환한다.
 *
 * 반환은 **참고값**이며 관리자가 확정 결산 후 수동 조정할 수 있다.
 * (NPO 회계 특성상 결산 확정 전 실시간 집계는 참고용으로만 사용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const year = Number(req.nextUrl.searchParams.get('year'))
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    return NextResponse.json({ error: 'invalid_year' }, { status: 400 })
  }

  const startIso = new Date(Date.UTC(year, 0, 1)).toISOString()
  const endIso = new Date(Date.UTC(year + 1, 0, 1)).toISOString()

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('payments')
    .select('amount')
    .eq('org_id', tenant.id)
    .eq('status', 'paid')
    .gte('paid_at', startIso)
    .lt('paid_at', endIso)

  if (error) {
    console.error('[finance/yearly-summary]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const totalRaised = (data ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0)

  return NextResponse.json({
    year,
    totalRaised,
    paidCount: data?.length ?? 0,
    note: '참고값 — 확정 결산 후 수동 조정 권장',
  })
}
