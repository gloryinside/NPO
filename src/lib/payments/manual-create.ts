import type { SupabaseClient } from '@supabase/supabase-js'
import { generatePromiseCode, generatePaymentCode } from '@/lib/codes'

/**
 * Phase 7-D-2-a: 관리자 수기 납부 생성.
 *
 * 흐름 (auto-promise):
 *   1. promises INSERT — type='onetime', status='completed', ended_at=payDate
 *   2. payments INSERT — promise_id, pay_status='paid', deposit_date=payDate
 *   3. payments INSERT 실패 시 promises DELETE (best-effort 롤백)
 *
 * Supabase JS SDK는 트랜잭션 미지원이라 순서 기반 보증. 임계 금액 요구 발생 시
 * PostgREST function으로 이식하는 것을 검토. 지금은 수기 입력 빈도가 낮아 순서 보증
 * + 롤백으로 충분.
 */

export const MIN_MANUAL_AMOUNT = 1
export const MAX_MANUAL_AMOUNT = 100_000_000

export type ManualPayMethod = 'cash' | 'transfer' | 'manual'

const PAY_METHODS: readonly ManualPayMethod[] = [
  'cash',
  'transfer',
  'manual',
] as const

export interface CreateManualPaymentInput {
  supabase: SupabaseClient
  orgId: string
  memberId: string
  amount: number
  payDate: string // YYYY-MM-DD
  payMethod: ManualPayMethod
  campaignId?: string | null
  note?: string | null
}

export type CreateManualPaymentResult =
  | {
      ok: true
      paymentId: string
      promiseId: string
      paymentCode: string
    }
  | {
      ok: false
      error: 'INVALID_AMOUNT' | 'INVALID_DATE' | 'INVALID_METHOD' | 'INSERT_FAILED'
    }

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false
  const ts = Date.parse(s)
  return Number.isFinite(ts)
}

export async function createManualPayment(
  input: CreateManualPaymentInput
): Promise<CreateManualPaymentResult> {
  const { supabase, orgId, memberId, amount, payDate, payMethod } = input

  // 1. 입력 검증
  if (
    !Number.isFinite(amount) ||
    amount < MIN_MANUAL_AMOUNT ||
    amount > MAX_MANUAL_AMOUNT
  ) {
    return { ok: false, error: 'INVALID_AMOUNT' }
  }
  if (!isValidDate(payDate)) {
    return { ok: false, error: 'INVALID_DATE' }
  }
  if (!PAY_METHODS.includes(payMethod)) {
    return { ok: false, error: 'INVALID_METHOD' }
  }

  const year = new Date().getFullYear()

  // 2. promises seq 계산 + INSERT (type=onetime, status=completed)
  const { count: promiseCount } = await supabase
    .from('promises')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const promiseSeq = (promiseCount ?? 0) + 1
  const promiseCode = generatePromiseCode(year, promiseSeq)

  const { data: promiseInsert, error: promiseErr } = await supabase
    .from('promises')
    .insert({
      org_id: orgId,
      member_id: memberId,
      campaign_id: input.campaignId ?? null,
      promise_code: promiseCode,
      type: 'onetime',
      status: 'completed',
      amount,
      pay_method: payMethod,
      started_at: payDate,
      ended_at: payDate,
    })
    .select('id')
    .single()

  if (promiseErr || !promiseInsert) {
    return { ok: false, error: 'INSERT_FAILED' }
  }

  const promiseId = promiseInsert.id as string

  // 3. payments seq 계산 + INSERT
  const { count: paymentCount } = await supabase
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('org_id', orgId)

  const paymentSeq = (paymentCount ?? 0) + 1
  const paymentCode = generatePaymentCode(year, paymentSeq)

  const { data: paymentInsert, error: paymentErr } = await supabase
    .from('payments')
    .insert({
      org_id: orgId,
      member_id: memberId,
      promise_id: promiseId,
      campaign_id: input.campaignId ?? null,
      payment_code: paymentCode,
      amount,
      pay_date: payDate,
      deposit_date: payDate,
      pay_status: 'paid',
      income_status: 'pending',
      pay_method: payMethod,
    })
    .select('id')
    .single()

  if (paymentErr || !paymentInsert) {
    // best-effort rollback: promise 삭제
    await supabase.from('promises').delete().eq('id', promiseId)
    return { ok: false, error: 'INSERT_FAILED' }
  }

  return {
    ok: true,
    paymentId: paymentInsert.id as string,
    promiseId,
    paymentCode,
  }
}
