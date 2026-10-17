import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { chargePayment, MAX_ATTEMPTS } from './charge-one'
import { notifyOutcome } from './charge-service'

/**
 * 실패한 정기결제 자동 재시도(+1일·+3일·+7일, 최대 3회 → 약정 정지).
 * 활성 약정만 — 예전엔 약정 상태를 보지 않아 해지·정지된 약정도 계속 청구했다.
 * 결과 불명(네트워크)으로 남은 미결제 건도 같은 멱등키로 다시 시도해 결과를 회수한다.
 */
export async function processRetries(orgId: string): Promise<{ retried: number; suspended: number }> {
  const keys = await getOrgTossKeys(orgId)
  if (!keys.tossSecretKey) {
    console.error(`[retry] org ${orgId}: tossSecretKey 없음`)
    return { retried: 0, suspended: 0 }
  }

  const supabase = createSupabaseAdminClient()
  const { data: payments, error } = await supabase
    .from('payments')
    .select('id, member_id, amount, payment_code, promises!inner(id, status)')
    .eq('org_id', orgId)
    .eq('pay_status', 'failed')
    .eq('promises.status', 'active')
    .lt('retry_count', MAX_ATTEMPTS)
    .lte('next_retry_at', new Date().toISOString())
    .is('toss_payment_key', null)

  if (error) {
    console.error(`[retry] org ${orgId}: 조회 실패`, error.message)
    return { retried: 0, suspended: 0 }
  }

  let retried = 0
  let suspended = 0
  for (const p of payments ?? []) {
    const outcome = await chargePayment(supabase, keys.tossSecretKey, { paymentId: p.id, orgId }, 'auto')
    const promiseId = (p.promises as unknown as { id: string }).id
    await notifyOutcome(orgId, { id: p.id, member_id: p.member_id, amount: p.amount, payment_code: p.payment_code, promise_id: promiseId }, outcome)
    if (outcome.kind === 'paid') retried++
    if (outcome.kind === 'suspended') suspended++
  }
  return { retried, suspended }
}
