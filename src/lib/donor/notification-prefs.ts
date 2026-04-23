import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 7-A / G-115 / G-D35: 후원자 알림 수신 설정.
 *
 * members.notification_prefs (JSONB) 한 컬럼에 여러 알림 토글을 담는다.
 * 키가 없으면 기본값(opt-in)으로 간주 — 기존 회원에 마이그레이션 후에도
 * 자동으로 "받음" 상태.
 *
 * G-D35: 4종 추가 (payment_confirmation, receipt_issued, promise_status, campaign_update)
 *   기존 키 amount_change 는 그대로 유지 (backward compat).
 */

export interface NotificationPrefs {
  /** 정기후원 금액 변경(업/다운) 감사 이메일 수신 여부. 기본 true */
  amount_change: boolean
  /** 결제 완료 확인 이메일 수신 여부. 기본 true */
  payment_confirmation: boolean
  /** 영수증 발급 알림 수신 여부. 기본 true */
  receipt_issued: boolean
  /** 약정 상태 변경(일시중지·재개·해지) 알림 수신 여부. 기본 true */
  promise_status: boolean
  /** 캠페인 진행 소식/후기 알림 수신 여부. 기본 true */
  campaign_update: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  amount_change: true,
  payment_confirmation: true,
  receipt_issued: true,
  promise_status: true,
  campaign_update: true,
}

/**
 * DB의 raw JSONB를 안전하게 파싱. 키가 없거나 타입이 다르면 기본값으로 fallback.
 */
export function parseNotificationPrefs(raw: unknown): NotificationPrefs {
  const src = (raw ?? {}) as Record<string, unknown>
  const getBool = (key: keyof NotificationPrefs) =>
    typeof src[key] === 'boolean'
      ? (src[key] as boolean)
      : DEFAULT_NOTIFICATION_PREFS[key]
  return {
    amount_change: getBool('amount_change'),
    payment_confirmation: getBool('payment_confirmation'),
    receipt_issued: getBool('receipt_issued'),
    promise_status: getBool('promise_status'),
    campaign_update: getBool('campaign_update'),
  }
}

export async function getNotificationPrefs(
  supabase: SupabaseClient,
  memberId: string
): Promise<NotificationPrefs> {
  const { data } = await supabase
    .from('members')
    .select('notification_prefs')
    .eq('id', memberId)
    .maybeSingle()
  return parseNotificationPrefs(
    (data as { notification_prefs?: unknown } | null)?.notification_prefs
  )
}

/**
 * partial merge. `undefined` 필드는 건드리지 않는다.
 * 반환: 업데이트된 최종 prefs 혹은 null (실패).
 */
export async function updateNotificationPrefs(
  supabase: SupabaseClient,
  memberId: string,
  patch: Partial<NotificationPrefs>
): Promise<NotificationPrefs | null> {
  const current = await getNotificationPrefs(supabase, memberId)
  const next: NotificationPrefs = { ...current }
  const keys: (keyof NotificationPrefs)[] = [
    'amount_change',
    'payment_confirmation',
    'receipt_issued',
    'promise_status',
    'campaign_update',
  ]
  for (const key of keys) {
    if (typeof patch[key] === 'boolean') {
      next[key] = patch[key] as boolean
    }
  }
  const { error } = await supabase
    .from('members')
    .update({ notification_prefs: next })
    .eq('id', memberId)
  if (error) return null
  return next
}
