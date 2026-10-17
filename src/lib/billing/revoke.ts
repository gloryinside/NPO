/**
 * 약정 해지·종료·탈퇴 시 결제수단 폐기 — 토스 규격: 쓰지 않는 빌링키는 삭제 API로 지운다.
 *   1) 토스에서 빌링키 삭제(DELETE /v1/billing/{billingKey})
 *   2) DB의 빌링키·customerKey 제거
 *   3) 그 약정의 미결제(unpaid/failed) 청구를 취소 — 재시도 크론이 해지 후에도 결제하던 문제 방지
 * 토스 삭제가 실패해도 DB에서 지우면 우리 쪽에서 다시 결제할 경로는 없다(로그로 남겨 수동 정리).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { deleteBillingKey } from './toss-billing'
import { openBillingKey } from './billing-key-store'

export async function revokePromiseBilling(
  supabase: SupabaseClient,
  orgId: string,
  promiseIds: string[],
): Promise<{ revoked: number; tossFailures: number }> {
  if (promiseIds.length === 0) return { revoked: 0, tossFailures: 0 }

  const { data: rows } = await supabase
    .from('promises')
    .select('id, toss_billing_key')
    .eq('org_id', orgId)
    .in('id', promiseIds)
    .not('toss_billing_key', 'is', null)

  let revoked = 0
  let tossFailures = 0
  const keys = rows?.length ? await getOrgTossKeys(orgId) : null
  for (const r of rows ?? []) {
    const billingKey = await openBillingKey(r.toss_billing_key)
    if (billingKey && keys?.tossSecretKey) {
      const res = await deleteBillingKey(keys.tossSecretKey, billingKey)
      if (!res.ok) {
        tossFailures++
        console.error(`[billing/revoke] promise ${r.id}: 토스 빌링키 삭제 실패 — 수동 정리 필요`, res.error)
      }
    }
    revoked++
  }

  await supabase
    .from('promises')
    .update({ toss_billing_key: null, customer_key: null, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .in('id', promiseIds)

  await supabase
    .from('payments')
    .update({ pay_status: 'cancelled', next_retry_at: null, updated_at: new Date().toISOString() })
    .eq('org_id', orgId)
    .in('promise_id', promiseIds)
    .in('pay_status', ['unpaid', 'failed'])
    .is('toss_payment_key', null)
    .is('charging_started_at', null)

  return { revoked, tossFailures }
}
