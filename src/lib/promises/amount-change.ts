import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Phase 5-C: 정기후원 약정 금액 변경 공용 lib.
 *
 * 변경 흐름:
 *   1. 현재 amount와 비교해 direction 결정 (up/down/same)
 *   2. promises.amount UPDATE
 *   3. 미청구(pending, toss_payment_key IS NULL) payments.amount 동기화
 *   4. promise_amount_changes 이력 1행 INSERT
 *
 * 트랜잭션은 Supabase JS SDK로 보장할 수 없으므로, 순서상 가장 중요한
 * promises 업데이트를 먼저 수행하고 나머지는 best-effort 로 잇는다.
 * 이력 INSERT 실패는 경고 레벨로만 로깅하고 주 변경은 반환한다.
 *
 * 최소/최대 가드:
 *   - 1,000원 미만 거부 (실질적 의미 없음)
 *   - 100,000,000원 초과 거부 (오타/오입력 방지)
 */

export const MIN_PROMISE_AMOUNT = 1_000
export const MAX_PROMISE_AMOUNT = 100_000_000

export type ChangeActor = 'member' | 'admin' | 'system'
export type ChangeDirection = 'up' | 'down' | 'same'

export interface ChangeAmountParams {
  supabase: SupabaseClient
  promiseId: string
  orgId: string
  memberId: string
  currentAmount: number
  newAmount: number
  actor: ChangeActor
  actorId?: string | null
  reason?: string | null
}

export interface ChangeAmountSuccess {
  ok: true
  promiseId: string
  previousAmount: number
  newAmount: number
  direction: ChangeDirection
  historyId: string | null
}

export interface ChangeAmountFailure {
  ok: false
  error:
    | 'invalid_amount'
    | 'below_minimum'
    | 'above_maximum'
    | 'update_failed'
}

export type ChangeAmountResult = ChangeAmountSuccess | ChangeAmountFailure

export function classifyDirection(
  previous: number,
  next: number
): ChangeDirection {
  if (next > previous) return 'up'
  if (next < previous) return 'down'
  return 'same'
}

export async function changePromiseAmount(
  params: ChangeAmountParams
): Promise<ChangeAmountResult> {
  const {
    supabase,
    promiseId,
    orgId,
    memberId,
    currentAmount,
    newAmount,
    actor,
    actorId = null,
    reason = null,
  } = params

  if (!Number.isFinite(newAmount) || newAmount <= 0) {
    return { ok: false, error: 'invalid_amount' }
  }
  if (newAmount < MIN_PROMISE_AMOUNT) {
    return { ok: false, error: 'below_minimum' }
  }
  if (newAmount > MAX_PROMISE_AMOUNT) {
    return { ok: false, error: 'above_maximum' }
  }

  const direction = classifyDirection(currentAmount, newAmount)

  const { error: updateErr } = await supabase
    .from('promises')
    .update({ amount: newAmount, updated_at: new Date().toISOString() })
    .eq('id', promiseId)

  if (updateErr) {
    return { ok: false, error: 'update_failed' }
  }

  // 미청구 pending payments 동기화 (processMonthlyCharges가 payment.amount를 참조)
  await supabase
    .from('payments')
    .update({ amount: newAmount })
    .eq('promise_id', promiseId)
    .eq('pay_status', 'pending')
    .is('toss_payment_key', null)

  // 이력 INSERT — 실패해도 주 흐름은 성공 반환
  let historyId: string | null = null
  const { data: history } = await supabase
    .from('promise_amount_changes')
    .insert({
      org_id: orgId,
      promise_id: promiseId,
      member_id: memberId,
      previous_amount: currentAmount,
      new_amount: newAmount,
      direction,
      actor,
      actor_id: actorId,
      reason,
    })
    .select('id')
    .maybeSingle()

  if (history?.id) historyId = history.id as string

  return {
    ok: true,
    promiseId,
    previousAmount: currentAmount,
    newAmount,
    direction,
    historyId,
  }
}

/**
 * 특정 약정의 금액 변경 이력을 최신순으로 반환.
 */
export interface AmountChangeRecord {
  id: string
  previousAmount: number
  newAmount: number
  direction: ChangeDirection
  actor: ChangeActor
  reason: string | null
  createdAt: string
}

export async function listAmountChanges(
  supabase: SupabaseClient,
  promiseId: string
): Promise<AmountChangeRecord[]> {
  const { data } = await supabase
    .from('promise_amount_changes')
    .select(
      'id, previous_amount, new_amount, direction, actor, reason, created_at'
    )
    .eq('promise_id', promiseId)
    .order('created_at', { ascending: false })

  const rows = (data ?? []) as Array<{
    id: string
    previous_amount: number
    new_amount: number
    direction: ChangeDirection
    actor: ChangeActor
    reason: string | null
    created_at: string
  }>

  return rows.map((r) => ({
    id: r.id,
    previousAmount: Number(r.previous_amount),
    newAmount: Number(r.new_amount),
    direction: r.direction,
    actor: r.actor,
    reason: r.reason,
    createdAt: r.created_at,
  }))
}
