import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

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

  const summary = {
    closedByDeadline: expired?.length ?? 0,
    closedByGoal: goalReached.length,
    deadlineList: expired?.map((e) => ({ id: e.id, title: e.title })) ?? [],
    goalList: goalReached.map((g) => ({ id: g.id, title: g.title, raised: g.raised, goal: g.goal })),
  }
  if (summary.closedByDeadline + summary.closedByGoal > 0) {
    console.log('[cron/auto-close-campaigns]', summary)
  }

  return NextResponse.json(summary)
}
