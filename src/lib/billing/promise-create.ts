/**
 * 약정(promises) 생성 — promise_code(NOT NULL, 기관별 UNIQUE)를 붙여 넣는다.
 * 코드는 DB 카운터(next_code_seq)로 원자 발번. 카운터보다 앞선 번호가 손으로 들어가 있어 겹치면 다음 번호로 최대 5번 재시도.
 * (예전 후원 신청 경로는 promise_code·started_at 없이 넣고 오류를 무시해 약정이 조용히 사라졌다)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { nextCode } from '@/lib/codes-seq'
import { kstParts, kstToday } from './kst'

export async function insertPromise(
  supabase: SupabaseClient,
  orgId: string,
  row: Record<string, unknown>,
): Promise<{ id: string; promise_code: string } | { error: string }> {
  const { year } = kstParts()
  for (let attempt = 0; attempt < 5; attempt++) {
    let promiseCode: string
    try {
      promiseCode = await nextCode(supabase, orgId, 'promise', year)
    } catch (e) {
      return { error: (e as Error).message }
    }
    const { data, error } = await supabase
      .from('promises')
      .insert({ started_at: kstToday(), ...row, org_id: orgId, promise_code: promiseCode })
      .select('id, promise_code')
      .single()
    if (!error && data) return data as { id: string; promise_code: string }
    if (error?.code !== '23505' || !error.message.includes('promise_code')) {
      return { error: error?.message ?? 'insert_failed' }
    }
  }
  return { error: 'promise_code_conflict' }
}
