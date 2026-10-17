/**
 * 결제창 카드 등록(requestBillingAuth) 완료 처리 — successUrl로 돌아온 authKey로 빌링키를 발급한다.
 * 토스 규격: POST /v1/billing/authorizations/issue { authKey, customerKey }
 *
 * 안전장치
 *  - 약정은 이 기관(테넌트)의 것이고, 카드 등록 대기(pending_billing)이며,
 *    customerKey가 신청 때 저장한 값과 같아야 한다(다른 약정에 카드를 붙이는 것 방지).
 *  - 같은 URL을 새로고침해도 안전: 이미 등록된 약정이면 발급하지 않고 성공으로 본다.
 *  - 저장 실패 시 방금 발급한 빌링키를 토스에서 삭제해 고아 키를 남기지 않는다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgTossKeys } from '@/lib/toss/keys'
import { deleteBillingKey, issueBillingKeyByAuth } from './toss-billing'
import { openBillingKey, sealBillingKey } from './billing-key-store'

export type CompleteBillingAuthResult =
  | { ok: true; alreadyDone: boolean; amount: number; promiseCode: string }
  | { ok: false; reason: 'invalid_request' | 'not_found' | 'customer_mismatch' | 'toss_unavailable' | 'issue_failed' | 'save_failed'; message?: string }

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function completeBillingAuth(
  supabase: SupabaseClient,
  orgId: string,
  input: { promiseId?: string | null; authKey?: string | null; customerKey?: string | null },
  /** activate: 신청 직후 첫 등록(pending_billing) · replace: 후원자 카드 변경 */
  opts: { mode?: 'activate' | 'replace'; memberId?: string } = {},
): Promise<CompleteBillingAuthResult> {
  const mode = opts.mode ?? 'activate'
  const { promiseId, authKey, customerKey } = input
  if (!promiseId || !UUID_RE.test(promiseId) || !authKey || !customerKey || customerKey.length > 50) {
    return { ok: false, reason: 'invalid_request' }
  }

  let q = supabase
    .from('promises')
    .select('id, status, customer_key, toss_billing_key, amount, promise_code, suspended_until')
    .eq('id', promiseId)
    .eq('org_id', orgId)
  if (opts.memberId) q = q.eq('member_id', opts.memberId) // 카드 변경은 본인 약정만
  const { data: promise } = await q.maybeSingle()
  if (!promise) return { ok: false, reason: 'not_found' }
  if (promise.customer_key !== customerKey) return { ok: false, reason: 'customer_mismatch' }

  if (mode === 'activate') {
    // 새로고침·중복 호출 — 이미 등록 완료
    if (promise.status === 'active' && promise.toss_billing_key) {
      return { ok: true, alreadyDone: true, amount: promise.amount, promiseCode: promise.promise_code }
    }
    if (promise.status !== 'pending_billing') return { ok: false, reason: 'not_found' }
  } else if (promise.status === 'cancelled' || promise.status === 'completed') {
    return { ok: false, reason: 'not_found' }
  }

  const keys = await getOrgTossKeys(orgId)
  if (!keys.tossSecretKey) return { ok: false, reason: 'toss_unavailable' }

  const issued = await issueBillingKeyByAuth(keys.tossSecretKey, authKey, customerKey)
  if (!issued.success) return { ok: false, reason: 'issue_failed', message: issued.error }

  // 결제 실패로 정지된 약정(후원자가 직접 멈춘 suspended_until 없음)은 새 카드로 재개
  const reactivate = promise.status === 'pending_billing' || (promise.status === 'suspended' && !promise.suspended_until)
  let upd = supabase
    .from('promises')
    .update({
      toss_billing_key: await sealBillingKey(issued.billingKey),
      status: reactivate ? 'active' : promise.status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', promiseId)
    .eq('org_id', orgId)
    .eq('customer_key', customerKey)
  // 첫 등록은 동시 완료 경쟁 방지(먼저 끝낸 한 곳만), 카드 변경은 읽은 키가 그대로일 때만
  upd = mode === 'activate'
    ? upd.eq('status', 'pending_billing')
    : promise.toss_billing_key
      ? upd.eq('toss_billing_key', promise.toss_billing_key)
      : upd.is('toss_billing_key', null)
  const { data: updated, error } = await upd.select('id')
  if (error || !updated?.length) {
    await deleteBillingKey(keys.tossSecretKey, issued.billingKey)
    return error
      ? { ok: false, reason: 'save_failed', message: error.message }
      : { ok: true, alreadyDone: true, amount: promise.amount, promiseCode: promise.promise_code }
  }
  // 카드 변경 — 예전 빌링키는 토스에서 삭제(실패해도 새 카드는 적용됨, 로그만)
  if (mode === 'replace') {
    const oldKey = await openBillingKey(promise.toss_billing_key)
    if (oldKey && oldKey !== issued.billingKey) {
      const del = await deleteBillingKey(keys.tossSecretKey, oldKey)
      if (!del.ok) console.error(`[billing] promise ${promiseId}: 이전 빌링키 삭제 실패`, del.error)
    }
  }
  return { ok: true, alreadyDone: false, amount: promise.amount, promiseCode: promise.promise_code }
}
