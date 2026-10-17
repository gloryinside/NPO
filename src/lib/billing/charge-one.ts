/**
 * 정기후원 결제 1건 처리 — 월 청구·자동 재시도·수동 재시도가 모두 이 함수를 거친다.
 *
 * 토스 자동결제 규격 + 이중 결제 방지:
 *  1) 선점(claim): pay_status ∈ (unpaid, failed) 이고 아무도 처리 중이 아닐 때만
 *     charging_started_at을 찍는 조건부 UPDATE. 0행이면 다른 곳에서 처리 중 → 건너뜀.
 *  2) 약정 상태 확인: 자동 경로는 active만, 수동은 active|suspended(카드 교체 후 재청구).
 *  3) 승인: 시도별 orderId + Idempotency-Key. 응답 status=DONE·금액 일치만 성공.
 *  4) 결과 기록도 조건부(pay_status가 여전히 미결제일 때만)로 덮어쓰기 경쟁을 막는다.
 *  5) 네트워크 오류(결과 모름)는 시도 번호를 올리지 않는다 → 다음 실행이 같은 멱등키로 결과를 회수.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { chargeBillingKey, toTossOrderId } from './toss-billing'
import { openBillingKey } from './billing-key-store'

/** 실패 n번째(1부터) 후 다음 재시도까지 — 1일, 3일, 7일 */
export const RETRY_DELAYS_MS = [1, 3, 7].map((d) => d * 86_400_000)
export const MAX_ATTEMPTS = 3
/** 선점이 이보다 오래되면 비정상 종료로 보고 다시 잡을 수 있다 */
const CLAIM_TTL_MS = 15 * 60_000

export type ChargeMode = 'auto' | 'manual'

export type ChargeOutcome =
  | { kind: 'paid'; paymentKey: string; approvedAt: string }
  | { kind: 'failed'; attempt: number; nextRetryAt: string | null; message: string }
  | { kind: 'suspended'; attempt: number; message: string } // 재시도 소진 → 약정 정지
  | { kind: 'needs_review'; message: string } // 재시도해도 소용없는 실패(카드 정지·금액 불일치 등)
  | { kind: 'unknown'; message: string } // 네트워크 오류 — 다음 실행에서 같은 멱등키로 회수
  | { kind: 'skipped'; reason: string }

export type ChargeTarget = {
  paymentId: string
  orgId: string
}

type Row = {
  id: string
  org_id: string
  member_id: string
  amount: number
  payment_code: string | null
  retry_count: number | null
  pay_status: string
  promises: {
    id: string
    status: string
    toss_billing_key: string | null
    customer_key: string | null
  } | null
}

export async function chargePayment(
  supabase: SupabaseClient,
  secretKey: string,
  target: ChargeTarget,
  mode: ChargeMode,
): Promise<ChargeOutcome> {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - CLAIM_TTL_MS).toISOString()

  // 1) 선점 — 조건부 UPDATE. 컬럼 미적용 등 오류면 결제하지 않는다(fail-safe)
  const { data: claimed, error: claimErr } = await supabase
    .from('payments')
    .update({ charging_started_at: now.toISOString() })
    .eq('id', target.paymentId)
    .eq('org_id', target.orgId)
    .in('pay_status', ['unpaid', 'failed'])
    .is('toss_payment_key', null)
    .or(`charging_started_at.is.null,charging_started_at.lt.${staleBefore}`)
    .select('id')
  if (claimErr) return { kind: 'skipped', reason: `claim_error: ${claimErr.message}` }
  if (!claimed?.length) return { kind: 'skipped', reason: 'already_processing_or_done' }

  const release = (patch: Record<string, unknown> = {}) =>
    supabase
      .from('payments')
      .update({ charging_started_at: null, ...patch })
      .eq('id', target.paymentId)
      .eq('org_id', target.orgId)
      .in('pay_status', ['unpaid', 'failed'])

  const { data: row, error: rowErr } = await supabase
    .from('payments')
    .select('id, org_id, member_id, amount, payment_code, retry_count, pay_status, promises(id, status, toss_billing_key, customer_key)')
    .eq('id', target.paymentId)
    .eq('org_id', target.orgId)
    .single<Row>()
  if (rowErr || !row) {
    await release()
    return { kind: 'skipped', reason: 'row_not_found' }
  }

  // 2) 약정 상태
  const promise = row.promises
  const allowed = mode === 'auto' ? ['active'] : ['active', 'suspended']
  if (!promise || !allowed.includes(promise.status)) {
    await release()
    return { kind: 'skipped', reason: `promise_${promise?.status ?? 'missing'}` }
  }
  const billingKey = await openBillingKey(promise.toss_billing_key)
  if (!billingKey || !promise.customer_key) {
    await release()
    return { kind: 'skipped', reason: 'no_billing_key' }
  }

  // 3) 승인 — 시도 번호는 "실패로 확정된 횟수". 네트워크 오류는 올리지 않아 같은 키로 재요청된다
  const attempt = row.retry_count ?? 0
  const base = row.payment_code ?? row.id
  const orderId = toTossOrderId(attempt === 0 ? base : `${base}-R${attempt}`)
  const result = await chargeBillingKey(secretKey, billingKey, {
    customerKey: promise.customer_key,
    amount: row.amount,
    orderId,
    orderName: attempt === 0 ? '정기후원' : '정기후원 재청구',
    idempotencyKey: `npo-charge-${row.id}-${attempt}`,
  })

  // 4) 결과 기록(조건부)
  if (result.success) {
    const approvedAt = result.approvedAt ?? now.toISOString()
    await supabase
      .from('payments')
      .update({
        pay_status: 'paid',
        toss_payment_key: result.paymentKey,
        toss_order_id: orderId,
        approved_at: approvedAt,
        deposit_date: approvedAt.slice(0, 10),
        fail_reason: null,
        next_retry_at: null,
        charging_started_at: null,
      })
      .eq('id', row.id)
      .eq('org_id', row.org_id)
      .in('pay_status', ['unpaid', 'failed'])
    return { kind: 'paid', paymentKey: result.paymentKey, approvedAt }
  }

  if (result.failureCode === 'NETWORK_ERROR') {
    await release({ toss_order_id: orderId })
    return { kind: 'unknown', message: result.failureMessage }
  }

  const failedAttempts = attempt + 1
  const message = `[${result.failureCode}] ${result.failureMessage}`

  if (!result.retryable) {
    await release({ pay_status: 'failed', retry_count: failedAttempts, fail_reason: message, next_retry_at: null, toss_order_id: orderId })
    return { kind: 'needs_review', message }
  }

  if (failedAttempts >= MAX_ATTEMPTS) {
    await release({ pay_status: 'failed', retry_count: failedAttempts, fail_reason: message, next_retry_at: null, toss_order_id: orderId })
    await supabase
      .from('promises')
      .update({ status: 'suspended' })
      .eq('id', promise.id)
      .eq('org_id', row.org_id)
      .eq('status', 'active')
    return { kind: 'suspended', attempt: failedAttempts, message }
  }

  const nextRetryAt = new Date(now.getTime() + RETRY_DELAYS_MS[failedAttempts - 1]).toISOString()
  await release({ pay_status: 'failed', retry_count: failedAttempts, fail_reason: message, next_retry_at: nextRetryAt, toss_order_id: orderId })
  return { kind: 'failed', attempt: failedAttempts, nextRetryAt, message }
}
