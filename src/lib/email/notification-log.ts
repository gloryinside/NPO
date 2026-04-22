import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationKind =
  | 'churn_risk_weekly'
  | 'campaign_closed_thanks'
  | 'amount_change_up'
  | 'amount_change_down'

/**
 * G-85/G-86: 지난 N일 내 같은 (org, kind) 발송이 있었는지 확인.
 * 주간 알림 중복 방지용.
 */
export async function wasSentWithin(
  supabase: SupabaseClient,
  orgId: string,
  kind: NotificationKind,
  daysAgo: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - daysAgo * 86400_000).toISOString()
  const { count } = await supabase
    .from('email_notifications_log')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('kind', kind)
    .eq('status', 'sent')
    .gte('sent_at', cutoff)

  return (count ?? 0) > 0
}

/**
 * 발송 로그 기록. 캠페인 감사 이메일은 UNIQUE 인덱스로 중복 INSERT 시 에러 발생 → 호출부에서 처리.
 */
export async function logNotification(
  supabase: SupabaseClient,
  params: {
    orgId: string
    kind: NotificationKind
    recipientEmail: string
    refId?: string | null
    status?: 'sent' | 'failed'
    error?: string | null
  },
): Promise<{ ok: boolean; duplicate?: boolean; error?: string }> {
  const { error } = await supabase.from('email_notifications_log').insert({
    org_id: params.orgId,
    kind: params.kind,
    recipient_email: params.recipientEmail,
    ref_id: params.refId ?? null,
    status: params.status ?? 'sent',
    error: params.error ?? null,
  })

  if (error) {
    // UNIQUE 인덱스 위반은 중복 발송 방지 성공 의미
    if (error.code === '23505') {
      return { ok: false, duplicate: true }
    }
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * G-117: 특정 약정(ref_id)에 대해 최근 N분 내 같은 kind가 발송됐는지 확인.
 * 금액 변경 감사 이메일 debounce — 짧은 시간 내 반복 변경 시 중복 발송 방지.
 */
export async function wasSentForRefWithin(
  supabase: SupabaseClient,
  refId: string,
  kind: NotificationKind,
  minutesAgo: number,
): Promise<boolean> {
  const cutoff = new Date(Date.now() - minutesAgo * 60_000).toISOString()
  const { count } = await supabase
    .from('email_notifications_log')
    .select('id', { count: 'exact', head: true })
    .eq('ref_id', refId)
    .eq('kind', kind)
    .eq('status', 'sent')
    .gte('sent_at', cutoff)

  return (count ?? 0) > 0
}

/**
 * 캠페인 감사 이메일 이미 발송됐는지 확인 (UNIQUE 인덱스 조건과 일치).
 */
export async function alreadySentCampaignThanks(
  supabase: SupabaseClient,
  campaignId: string,
  recipientEmail: string,
): Promise<boolean> {
  const { count } = await supabase
    .from('email_notifications_log')
    .select('id', { count: 'exact', head: true })
    .eq('kind', 'campaign_closed_thanks')
    .eq('ref_id', campaignId)
    .eq('recipient_email', recipientEmail)
    .eq('status', 'sent')

  return (count ?? 0) > 0
}
