import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/admin/notifications/failed
 *
 * G-96: 최근 30일간 failed 상태의 이메일 발송 로그 조회.
 * 같은 (kind, ref_id, recipient_email) 조합은 가장 최근 실패 1건만.
 */
export async function GET() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const supabase = createSupabaseAdminClient()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()

  const { data, error } = await supabase
    .from('email_notifications_log')
    .select('id, kind, ref_id, recipient_email, status, error, sent_at')
    .eq('org_id', tenant.id)
    .eq('status', 'failed')
    .gte('sent_at', thirtyDaysAgo)
    .order('sent_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 같은 (kind, ref_id, recipient_email) 조합 중 가장 최근 1개만 + 이미 sent 있으면 제외
  const seen = new Set<string>()
  const candidates: typeof data = []
  for (const row of data ?? []) {
    const key = `${row.kind}|${row.ref_id}|${row.recipient_email}`
    if (seen.has(key)) continue
    seen.add(key)
    candidates.push(row)
  }

  // 이미 sent 기록 있는 조합은 제외
  const filtered = []
  for (const row of candidates) {
    if (!row.ref_id) {
      filtered.push(row)
      continue
    }
    const { count } = await supabase
      .from('email_notifications_log')
      .select('id', { count: 'exact', head: true })
      .eq('kind', row.kind)
      .eq('ref_id', row.ref_id)
      .eq('recipient_email', row.recipient_email)
      .eq('status', 'sent')
    if ((count ?? 0) === 0) filtered.push(row)
  }

  return NextResponse.json({ items: filtered })
}
