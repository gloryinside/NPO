import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send-email'
import { logNotification } from '@/lib/email/notification-log'

/**
 * GET /api/cron/retry-failed-emails
 *
 * Vercel Cron — daily 10:00 KST (= 01:00 UTC).
 * vercel.json: { "crons": [{ "path": "/api/cron/retry-failed-emails", "schedule": "0 1 * * *" }] }
 *
 * 지난 7일간 status='failed' + 같은 (kind, ref_id, recipient_email) 조합에
 * status='sent' 기록이 없는 이메일을 재발송 시도한다.
 *
 * 30일 이상 지난 실패는 재시도하지 않음 (포기 — 수동 개입 필요).
 * 현재는 campaign_closed_thanks만 재시도 대상 (church_risk_weekly는 주간 cron이 알아서 처리).
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString()

  // 최근 7일 failed + 30일 이내 failed (중복 방지: 같은 대상 조합당 1회)
  const { data: failedRows, error } = await supabase
    .from('email_notifications_log')
    .select('id, org_id, kind, ref_id, recipient_email, sent_at')
    .eq('status', 'failed')
    .eq('kind', 'campaign_closed_thanks')
    .gte('sent_at', thirtyDaysAgo)
    .lt('sent_at', sevenDaysAgo)
    .order('sent_at', { ascending: false })

  if (error) {
    console.error('[cron/retry-failed-emails]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 중복 제거 + 이미 sent 기록 있는 조합 제외
  const candidates = new Map<string, { orgId: string; refId: string | null; recipient: string }>()
  for (const r of failedRows ?? []) {
    const key = `${r.kind}|${r.ref_id}|${r.recipient_email}`
    if (!candidates.has(key)) {
      candidates.set(key, {
        orgId: r.org_id as string,
        refId: r.ref_id as string | null,
        recipient: r.recipient_email as string,
      })
    }
  }

  let retried = 0
  let skipped = 0
  for (const [, c] of candidates) {
    if (!c.refId) { skipped++; continue }

    // 1) 이미 sent 기록이 있으면 skip
    const { count: sentCount } = await supabase
      .from('email_notifications_log')
      .select('id', { count: 'exact', head: true })
      .eq('kind', 'campaign_closed_thanks')
      .eq('ref_id', c.refId)
      .eq('recipient_email', c.recipient)
      .eq('status', 'sent')
    if ((sentCount ?? 0) > 0) { skipped++; continue }

    // 2) 캠페인 & 수신자 정보 확인
    const { data: campaign } = await supabase
      .from('campaigns')
      .select('id, title, goal_amount, status')
      .eq('id', c.refId)
      .maybeSingle()
    if (!campaign || campaign.status !== 'closed') { skipped++; continue }

    const { data: paymentsSum } = await supabase
      .from('payments')
      .select('amount, members(name, email)')
      .eq('campaign_id', c.refId)
      .eq('pay_status', 'paid')

    const matches = (paymentsSum ?? []).filter((row) => {
      const m = (row as Record<string, unknown>).members as { email: string | null } | null
      return m?.email === c.recipient
    })
    if (matches.length === 0) { skipped++; continue }

    const totalAmount = matches.reduce(
      (s, row) => s + Number((row as { amount: number | null }).amount ?? 0),
      0,
    )
    const recipientName =
      (matches[0] as Record<string, unknown>).members as { name?: string } | null
    const name = recipientName?.name ?? '후원자'

    // 재발송
    const result = await sendEmail({
      to: c.recipient,
      subject: `🎉 [${campaign.title}] 감사 메시지 (재발송)`,
      html: `
        <div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:24px;">
          <h1 style="color:#1a3a5c;">감사합니다, ${escapeHtml(name)}님</h1>
          <p>지난번 발송이 실패하여 다시 보내드립니다.</p>
          <p><strong>${escapeHtml(campaign.title as string)}</strong> 캠페인이 목표를 달성했습니다.</p>
          <p>귀하의 누적 후원: <strong style="color:#7c3aed;">${totalAmount.toLocaleString('ko-KR')}원</strong></p>
        </div>
      `,
    })

    await logNotification(supabase, {
      orgId: c.orgId,
      kind: 'campaign_closed_thanks',
      recipientEmail: c.recipient,
      refId: c.refId,
      status: result.success ? 'sent' : 'failed',
      error: result.error ?? null,
    })

    if (result.success) retried++
    else skipped++
  }

  const summary = { candidates: candidates.size, retried, skipped }
  if (retried + skipped > 0) console.log('[cron/retry-failed-emails]', summary)
  return NextResponse.json(summary)
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
