import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send-email'
import { logNotification } from '@/lib/email/notification-log'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * GET /api/cron/auto-close-campaigns
 *
 * Vercel Cron — daily 09:00 KST (= 00:00 UTC).
 * vercel.json: { "crons": [{ "path": "/api/cron/auto-close-campaigns", "schedule": "0 0 * * *" }] }
 *
 * 두 가지 조건으로 캠페인 자동 마감:
 *   ① ended_at 이 지난 active 캠페인
 *   ② goal_amount 가 설정된 active 캠페인 중 paid 합계가 goal_amount 이상
 *
 * 모두 status = 'closed'로 전환. 후원자/관리자 알림은 별도(다음 스프린트).
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const nowIso = new Date().toISOString()

  // ① 기간 경과
  const { data: expired, error: expiredErr } = await supabase
    .from('campaigns')
    .update({ status: 'closed', updated_at: nowIso })
    .eq('status', 'active')
    .not('ended_at', 'is', null)
    .lt('ended_at', nowIso)
    .select('id, title, ended_at')

  if (expiredErr) {
    console.error('[cron/auto-close] expired update:', expiredErr)
    return NextResponse.json({ error: expiredErr.message }, { status: 500 })
  }

  // ② 목표 달성 — 집계 쿼리가 필요하므로 active + goal_amount 있는 캠페인 조회 후 개별 합산
  const { data: activeWithGoal, error: actErr } = await supabase
    .from('campaigns')
    .select('id, title, goal_amount')
    .eq('status', 'active')
    .not('goal_amount', 'is', null)
    .gt('goal_amount', 0)

  if (actErr) {
    console.error('[cron/auto-close] active fetch:', actErr)
    return NextResponse.json({ error: actErr.message }, { status: 500 })
  }

  const goalReached: Array<{ id: string; title: string; raised: number; goal: number }> = []
  for (const c of activeWithGoal ?? []) {
    const { data: sumData } = await supabase
      .from('payments')
      .select('amount')
      .eq('campaign_id', c.id as string)
      .eq('pay_status', 'paid')
    const raised = (sumData ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0)
    const goal = Number(c.goal_amount ?? 0)
    if (goal > 0 && raised >= goal) {
      goalReached.push({ id: c.id as string, title: c.title as string, raised, goal })
    }
  }

  if (goalReached.length > 0) {
    const { error: goalErr } = await supabase
      .from('campaigns')
      .update({ status: 'closed', updated_at: nowIso })
      .in(
        'id',
        goalReached.map((c) => c.id),
      )
    if (goalErr) {
      console.error('[cron/auto-close] goal update:', goalErr)
      return NextResponse.json({ error: goalErr.message }, { status: 500 })
    }
  }

  // G-86: 목표 달성 마감 캠페인의 기여 후원자에게 감사 이메일 발송
  // 기간 경과 마감은 감사 메시지 대상이 아님 (축하 맥락이 아니라서)
  let thanksEmailsSent = 0
  let thanksEmailsSkipped = 0
  for (const c of goalReached) {
    const result = await sendCampaignThanksEmails(supabase, c)
    thanksEmailsSent += result.sent
    thanksEmailsSkipped += result.skipped
  }

  const summary = {
    closedByDeadline: expired?.length ?? 0,
    closedByGoal: goalReached.length,
    deadlineList: expired?.map((e) => ({ id: e.id, title: e.title })) ?? [],
    goalList: goalReached.map((g) => ({ id: g.id, title: g.title, raised: g.raised, goal: g.goal })),
    thanksEmailsSent,
    thanksEmailsSkipped,
  }
  if (summary.closedByDeadline + summary.closedByGoal > 0) {
    console.log('[cron/auto-close-campaigns]', summary)
  }

  return NextResponse.json(summary)
}

/**
 * G-86: 목표 달성 캠페인의 기여 후원자(paid)에게 감사 이메일 발송.
 * UNIQUE 인덱스(kind, ref_id, recipient_email)로 중복 방지.
 */
async function sendCampaignThanksEmails(
  supabase: SupabaseClient,
  campaign: { id: string; title: string; raised: number; goal: number },
): Promise<{ sent: number; skipped: number }> {
  // 해당 캠페인의 paid 결제 → member 이메일 (중복 제거)
  const { data } = await supabase
    .from('payments')
    .select('member_id, amount, members(name, email, org_id)')
    .eq('campaign_id', campaign.id)
    .eq('pay_status', 'paid')

  const byEmail = new Map<string, { name: string; totalAmount: number; orgId: string }>()
  for (const row of data ?? []) {
    const m = (row as Record<string, unknown>).members as
      | { name: string; email: string | null; org_id: string }
      | null
    if (!m?.email) continue
    const prev = byEmail.get(m.email) ?? { name: m.name, totalAmount: 0, orgId: m.org_id }
    prev.totalAmount += Number((row as { amount: number | null }).amount ?? 0)
    byEmail.set(m.email, prev)
  }

  let sent = 0
  let skipped = 0
  for (const [email, info] of byEmail) {
    const html = renderThanksEmail({
      recipientName: info.name,
      campaignTitle: campaign.title,
      totalAmount: info.totalAmount,
      goal: campaign.goal,
      raised: campaign.raised,
    })

    const result = await sendEmail({
      to: email,
      subject: `🎉 [${campaign.title}] 캠페인이 목표를 달성했습니다`,
      html,
    })

    const logResult = await logNotification(supabase, {
      orgId: info.orgId,
      kind: 'campaign_closed_thanks',
      recipientEmail: email,
      refId: campaign.id,
      status: result.success ? 'sent' : 'failed',
      error: result.error ?? null,
    })

    if (logResult.duplicate) skipped++
    else if (result.success) sent++
  }

  return { sent, skipped }
}

function renderThanksEmail(params: {
  recipientName: string
  campaignTitle: string
  totalAmount: number
  goal: number
  raised: number
}): string {
  const pct = params.goal > 0 ? Math.round((params.raised / params.goal) * 100) : 100
  return `
    <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:640px;margin:0 auto;padding:32px 24px;color:#333;">
      <div style="text-align:center;padding:24px 0;">
        <div style="font-size:48px;">🎉</div>
        <h1 style="font-size:24px;font-weight:700;color:#1a3a5c;margin:8px 0;">목표를 달성했습니다!</h1>
      </div>
      <p style="font-size:15px;line-height:1.6;">
        <strong>${escapeHtml(params.recipientName)}</strong>님, 안녕하세요.<br/>
        여러분의 따뜻한 후원 덕분에 <strong>${escapeHtml(params.campaignTitle)}</strong> 캠페인이
        목표 금액 <strong>${params.goal.toLocaleString('ko-KR')}원</strong>을 달성하여 성공적으로 마감되었습니다.
      </p>
      <div style="background:#f8fafc;border-left:4px solid #7c3aed;padding:16px 20px;margin:24px 0;border-radius:4px;">
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;">당신의 후원</p>
        <p style="margin:0;font-size:22px;font-weight:700;color:#7c3aed;">
          ${params.totalAmount.toLocaleString('ko-KR')}원
        </p>
      </div>
      <p style="font-size:14px;color:#64748b;">
        최종 모금액 <strong style="color:#1a3a5c;">${params.raised.toLocaleString('ko-KR')}원</strong>
        (목표 대비 ${pct}%)
      </p>
      <p style="margin-top:24px;font-size:14px;line-height:1.6;">
        귀하의 참여가 실제 변화를 만들었습니다. 투명한 사용 내역은 기관 홈페이지에서 확인하실 수 있습니다.
      </p>
      <p style="margin-top:32px;font-size:11px;color:#94a3b8;border-top:1px solid #eee;padding-top:16px;">
        본 메일은 귀하가 해당 캠페인에 후원하셨기에 발송되었습니다. 캠페인당 1회만 발송됩니다.
      </p>
    </div>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
