import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { kstToday } from './kst'
import { chargePayment, type ChargeOutcome } from './charge-one'
import { createBillingFailedNotification, createPledgeSuspendedNotification } from './notifications'
import { notifyCmsChargeSuccess } from './notify-success'

/**
 * 월 정기결제 청구 — process-payments 크론이 만든 이번 달 미결제(unpaid) 행을 자동결제한다.
 * (예전엔 pending만 찾아 크론이 만든 unpaid 행을 한 번도 청구하지 않았다)
 */
export async function processMonthlyCharges(orgId: string): Promise<{ charged: number; failed: number }> {
  const keys = await getOrgTossKeys(orgId)
  if (!keys.tossSecretKey) {
    console.error(`[charge] org ${orgId}: tossSecretKey 없음`)
    return { charged: 0, failed: 0 }
  }

  const supabase = createSupabaseAdminClient()
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, member_id, amount, payment_code, promises!inner(id, status, toss_billing_key)')
    .eq('org_id', orgId)
    .eq('pay_status', 'unpaid')
    .eq('retry_count', 0)
    .eq('promises.status', 'active')
    .not('promises.toss_billing_key', 'is', null)
    .lte('pay_date', kstToday())
    .is('toss_payment_key', null)

  if (error) {
    console.error(`[charge] org ${orgId}: 조회 실패`, error.message)
    return { charged: 0, failed: 0 }
  }

  let charged = 0
  let failed = 0
  for (const p of payments ?? []) {
    const outcome = await chargePayment(supabase, keys.tossSecretKey, { paymentId: p.id, orgId }, 'auto')
    const promiseId = (p.promises as unknown as { id: string }).id
    await notifyOutcome(orgId, { id: p.id, member_id: p.member_id, amount: p.amount, payment_code: p.payment_code, promise_id: promiseId }, outcome)
    if (outcome.kind === 'paid') charged++
    else if (outcome.kind !== 'skipped' && outcome.kind !== 'unknown') failed++
  }
  return { charged, failed }
}

/** 결과별 알림 — 월 청구·재시도 공통 */
export async function notifyOutcome(
  orgId: string,
  p: { id: string; member_id: string; amount: number; payment_code: string | null; promise_id: string },
  outcome: ChargeOutcome,
): Promise<void> {
  switch (outcome.kind) {
    case 'paid':
      void notifyCmsChargeSuccess({
        orgId,
        paymentId: p.id,
        memberId: p.member_id,
        amount: p.amount,
        paymentCode: p.payment_code ?? p.id,
        approvedAt: outcome.approvedAt,
      })
      return
    case 'failed':
    case 'needs_review':
      await createBillingFailedNotification(orgId, p.id, p.member_id, p.amount, outcome.message)
      return
    case 'suspended':
      await createPledgeSuspendedNotification(orgId, p.promise_id, p.member_id, p.amount)
      return
    case 'unknown':
      console.warn(`[charge] payment ${p.id}: 결과 불명(네트워크) — 다음 실행에서 같은 멱등키로 회수`, outcome.message)
      return
    case 'skipped':
      return
  }
}
