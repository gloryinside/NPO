import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { fetchChurnRiskMembers } from '@/lib/stats/churn-risk'
import { sendEmail } from '@/lib/email/send-email'
import { wasSentWithin, logNotification } from '@/lib/email/notification-log'

/**
 * GET /api/cron/notify-churn-risk
 *
 * Vercel Cron — weekly Mon 09:00 KST (= Sun 00:00 UTC).
 * vercel.json: { "crons": [{ "path": "/api/cron/notify-churn-risk", "schedule": "0 0 * * 1" }] }
 *
 * 모든 tenant를 순회하며 이탈 위험 후원자(최근 6개월 미납 2회+)가 ≥ 3명이면
 * 기관 contact_email로 주간 알림 발송. 스팸 방지로 3명 미만이면 발송 안 함.
 *
 * 재발송 방지는 이메일 발신 로그 테이블 없이 단순히 주 1회 cron 스케줄로 대체.
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const supabase = createSupabaseAdminClient()
  const { data: orgs, error } = await supabase
    .from('orgs')
    .select('id, name, contact_email')
    .not('contact_email', 'is', null)

  if (error) {
    console.error('[cron/notify-churn-risk] orgs fetch:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const MIN_CHURN_COUNT = 3
  const results: Array<{ orgId: string; count: number; sent: boolean; error?: string }> = []

  for (const org of orgs ?? []) {
    const risk = await fetchChurnRiskMembers(supabase, org.id as string)
    if (risk.length < MIN_CHURN_COUNT) {
      results.push({ orgId: org.id as string, count: risk.length, sent: false })
      continue
    }

    // G-85: 지난 7일 내 이미 발송된 org는 skip (수동 재실행 중복 방지)
    const recentlySent = await wasSentWithin(supabase, org.id as string, 'churn_risk_weekly', 7)
    if (recentlySent) {
      results.push({ orgId: org.id as string, count: risk.length, sent: false, error: 'skipped_recent' })
      continue
    }

    const to = org.contact_email as string
    const orgName = (org.name as string) ?? '기관'
    const top5 = risk.slice(0, 5)
    const rowsHtml = top5
      .map(
        (m) => `
        <tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(m.memberName)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${m.unpaidCount}회</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${m.totalUnpaid.toLocaleString('ko-KR')}원</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${m.lastPayDate ?? '-'}</td>
        </tr>`,
      )
      .join('')

    const html = `
      <div style="font-family:-apple-system,'Noto Sans KR',sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#333;">
        <h1 style="font-size:20px;font-weight:700;color:#1a3a5c;">🚨 이탈 위험 후원자 주간 알림</h1>
        <p style="color:#64748b;font-size:14px;">${orgName} · 최근 6개월 내 미납/실패 2회 이상 후원자 <strong style="color:#ef4444;">${risk.length}명</strong></p>
        <table style="width:100%;margin-top:16px;border-collapse:collapse;font-size:14px;">
          <thead>
            <tr style="background:#f8fafc;">
              <th style="padding:8px 10px;text-align:left;">이름</th>
              <th style="padding:8px 10px;text-align:center;">미납</th>
              <th style="padding:8px 10px;text-align:right;">합계</th>
              <th style="padding:8px 10px;text-align:center;">최근</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        ${risk.length > 5 ? `<p style="color:#64748b;font-size:12px;margin-top:8px;">… 외 ${risk.length - 5}명</p>` : ''}
        <p style="margin-top:24px;font-size:13px;color:#334155;">
          상세 내역 및 개별 상담은 관리자 통계 페이지에서 확인하실 수 있습니다.
        </p>
        <p style="margin-top:8px;">
          <a href="${baseUrl()}/admin/stats" style="display:inline-block;background:#7c3aed;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
            통계 대시보드 열기 →
          </a>
        </p>
        <p style="margin-top:32px;font-size:11px;color:#94a3b8;">
          본 알림은 매주 월요일 자동 발송됩니다. 수신 거부는 기관 설정에서 contact_email을 변경하세요.
        </p>
      </div>
    `

    const result = await sendEmail({
      to,
      subject: `[${orgName}] 이탈 위험 후원자 ${risk.length}명 주간 리포트`,
      html,
    })

    // G-85: 발송 결과를 로그 테이블에 기록
    await logNotification(supabase, {
      orgId: org.id as string,
      kind: 'churn_risk_weekly',
      recipientEmail: to,
      status: result.success ? 'sent' : 'failed',
      error: result.error ?? null,
    })

    results.push({
      orgId: org.id as string,
      count: risk.length,
      sent: result.success,
      error: result.error,
    })
  }

  const sent = results.filter((r) => r.sent).length
  console.log('[cron/notify-churn-risk] sent:', sent, 'results:', results)
  return NextResponse.json({ sent, total: results.length, results })
}

function baseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://example.com'
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
