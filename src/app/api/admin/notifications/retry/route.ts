import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send-email'
import { logNotification } from '@/lib/email/notification-log'

/**
 * POST /api/admin/notifications/retry
 * body: { logId: string }
 *
 * G-96: 단일 실패 이메일 수동 재전송. retry-failed-emails cron과 동일 로직을 개별 호출.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const body = await req.json().catch(() => ({}))
  const logId = (body as { logId?: string }).logId
  if (!logId) return NextResponse.json({ error: 'logId_required' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { data: log } = await supabase
    .from('email_notifications_log')
    .select('org_id, kind, ref_id, recipient_email, status')
    .eq('id', logId)
    .maybeSingle()

  if (!log || log.org_id !== tenant.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }
  if (log.status === 'sent') {
    return NextResponse.json({ error: 'already_sent' }, { status: 400 })
  }

  // 현재는 campaign_closed_thanks만 지원 (가장 흔한 재전송 대상)
  if (log.kind !== 'campaign_closed_thanks' || !log.ref_id) {
    return NextResponse.json({ error: 'unsupported_kind' }, { status: 400 })
  }

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, title, goal_amount, status')
    .eq('id', log.ref_id)
    .maybeSingle()

  if (!campaign) return NextResponse.json({ error: 'campaign_missing' }, { status: 404 })

  const { data: payments } = await supabase
    .from('payments')
    .select('amount, members(name, email)')
    .eq('campaign_id', log.ref_id)
    .eq('pay_status', 'paid')

  const matches = (payments ?? []).filter((row) => {
    const m = (row as Record<string, unknown>).members as { email: string | null } | null
    return m?.email === log.recipient_email
  })
  if (matches.length === 0) {
    return NextResponse.json({ error: 'no_payment_match' }, { status: 404 })
  }

  const totalAmount = matches.reduce(
    (s, row) => s + Number((row as { amount: number | null }).amount ?? 0),
    0,
  )
  const first = (matches[0] as Record<string, unknown>).members as { name?: string } | null
  const name = first?.name ?? '후원자'

  const result = await sendEmail({
    to: log.recipient_email as string,
    subject: `🎉 [${campaign.title}] 감사 메시지 (수동 재발송)`,
    html: `
      <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px;">
        <h1 style="color:#1a3a5c;">감사합니다, ${escapeHtml(name)}님</h1>
        <p>관리자가 수동으로 재발송한 감사 메시지입니다.</p>
        <p><strong>${escapeHtml(campaign.title as string)}</strong> 캠페인이 목표를 달성했습니다.</p>
        <p>귀하의 누적 후원: <strong style="color:#7c3aed;">${totalAmount.toLocaleString('ko-KR')}원</strong></p>
      </div>
    `,
  })

  await logNotification(supabase, {
    orgId: tenant.id,
    kind: 'campaign_closed_thanks',
    recipientEmail: log.recipient_email as string,
    refId: log.ref_id as string,
    status: result.success ? 'sent' : 'failed',
    error: result.error ?? null,
  })

  if (!result.success) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
  }
  return NextResponse.json({ ok: true })
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
