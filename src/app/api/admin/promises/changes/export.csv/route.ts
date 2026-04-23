import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listChangesForExport } from '@/lib/promises/change-stats'
import { CSV_BOM, csvRow } from '@/lib/csv/escape'

/**
 * GET /api/admin/promises/changes/export.csv?days=180
 *
 * G-114: 약정 변경 이력 CSV 내보내기 (세무/회계팀 전달용).
 * - admin만 접근, org 단위로 필터
 * - days 파라미터는 30/90/180/365로 clamp (페이지 UI와 일치)
 * - 최대 10000 행. 초과 시 기간 축소 또는 별도 설계 필요.
 * - UTF-8 BOM + RFC 4180 escape — Excel(Windows) 한글 호환
 */
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const daysRaw = req.nextUrl.searchParams.get('days')
  const days = clampDays(daysRaw)

  const supabase = createSupabaseAdminClient()
  const rows = await listChangesForExport(supabase, guard.ctx.tenant.id, {
    sinceDays: days,
  })

  const headers = [
    '변경일시',
    '회원ID',
    '회원명',
    '캠페인',
    '이전 금액',
    '새 금액',
    '증감',
    '방향',
    '주체',
    '사유',
    '약정ID',
    '이력ID',
  ]

  const lines: string[] = [csvRow(headers)]
  for (const r of rows) {
    lines.push(
      csvRow([
        r.createdAt,
        r.memberId,
        r.memberName ?? '',
        r.campaignTitle ?? '',
        r.previousAmount,
        r.newAmount,
        r.delta,
        r.direction,
        r.actor ?? '',
        r.reason ?? '',
        r.promiseId,
        r.id,
      ])
    )
  }

  const body = CSV_BOM + lines.join('\n') + '\n'
  const today = new Date().toISOString().slice(0, 10)
  const filename = `promise-changes-${today}-${days}d.csv`

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

export function clampDays(raw: string | null): number {
  const allowed = [30, 90, 180, 365]
  const n = raw ? Number(raw) : NaN
  return allowed.includes(n) ? n : 180
}
