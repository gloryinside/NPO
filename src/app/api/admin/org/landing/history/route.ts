/**
 * GET /api/admin/org/landing/history — 최근 게시 이력(스냅샷 내용은 제외한 목록)
 */
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { tenantDb } from '@/lib/tenant/db'
import { HISTORY_LIST_LIMIT, type HistoryEntry } from '@/lib/landing/history'

export async function GET() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  // 기관 조건은 tenantDb가 강제(빠뜨리거나 바꿀 수 없음)
  const { data, error } = await tenantDb(tenant.id)
    .select('org_landing_history', 'id, section_count, published_by_email, created_at')
    .order('created_at', { ascending: false })
    .limit(HISTORY_LIST_LIMIT)
    .returns<{ id: string; section_count: number; published_by_email: string | null; created_at: string }[]>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const entries: HistoryEntry[] = (data ?? []).map((r) => ({
    id: r.id,
    sectionCount: r.section_count,
    publishedByEmail: r.published_by_email,
    createdAt: r.created_at,
  }))
  return NextResponse.json({ entries }, { headers: { 'Cache-Control': 'private, no-store' } })
}
