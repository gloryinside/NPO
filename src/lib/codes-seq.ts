/**
 * 회원·약정·결제 번호 발번 — DB 카운터(next_code_seq, 20261017000001)로 원자적으로 예약한다.
 *
 * 예전 방식("개수 + 1", "최근 행 번호 + 1")은 동시 요청·삭제·형식이 다른 번호가 섞이면
 * 같은 번호를 다시 내 유니크 위반으로 후원·가입이 실패했다.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateMemberCode, generatePaymentCode, generatePromiseCode } from '@/lib/codes'

export type CodeKind = 'member' | 'promise' | 'payment'

const FORMAT: Record<CodeKind, (year: number, seq: number) => string> = {
  member: generateMemberCode,
  promise: generatePromiseCode,
  payment: generatePaymentCode,
}

/** count개 번호를 예약해 순서대로 돌려준다. 실패 시 throw — 번호 없이 진행하지 않는다. */
export async function reserveCodes(
  supabase: SupabaseClient,
  orgId: string,
  kind: CodeKind,
  year: number,
  count = 1,
): Promise<string[]> {
  if (count < 1) return []
  const { data, error } = await supabase.rpc('next_code_seq', {
    p_org: orgId,
    p_kind: kind,
    p_year: year,
    p_count: count,
  })
  if (error || typeof data !== 'number') {
    throw new Error(`${kind} 번호 발급 실패: ${error?.message ?? 'no_seq'}`)
  }
  const first = data - count + 1
  return Array.from({ length: count }, (_, i) => FORMAT[kind](year, first + i))
}

export async function nextCode(
  supabase: SupabaseClient,
  orgId: string,
  kind: CodeKind,
  year: number,
): Promise<string> {
  const [code] = await reserveCodes(supabase, orgId, kind, year, 1)
  return code
}
