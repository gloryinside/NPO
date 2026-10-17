import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reserveCodes, nextCode } from '@/lib/codes-seq'

const rpcReturning = (result: { data: unknown; error: unknown }) =>
  ({ rpc: vi.fn(() => Promise.resolve(result)) }) as unknown as SupabaseClient

describe('reserveCodes — DB 카운터 예약', () => {
  it('반환값은 예약 블록의 마지막 번호 → 첫 번호부터 순서대로', async () => {
    const sb = rpcReturning({ data: 12, error: null })
    expect(await reserveCodes(sb, 'o1', 'member', 2026, 3)).toEqual(['M-202600010', 'M-202600011', 'M-202600012'])
    expect((sb as unknown as { rpc: ReturnType<typeof vi.fn> }).rpc).toHaveBeenCalledWith('next_code_seq', {
      p_org: 'o1', p_kind: 'member', p_year: 2026, p_count: 3,
    })
  })

  it('종류별 형식', async () => {
    expect(await nextCode(rpcReturning({ data: 7, error: null }), 'o1', 'payment', 2026)).toBe('PMT-202600007')
    expect(await nextCode(rpcReturning({ data: 7, error: null }), 'o1', 'promise', 2026)).toBe('P-202600007')
  })

  it('[실패] 번호 없이 진행하지 않는다', async () => {
    await expect(nextCode(rpcReturning({ data: null, error: { message: 'boom' } }), 'o1', 'member', 2026)).rejects.toThrow(/boom/)
  })

  it('0개 요청은 호출 없이 빈 배열', async () => {
    const sb = rpcReturning({ data: 1, error: null })
    expect(await reserveCodes(sb, 'o1', 'member', 2026, 0)).toEqual([])
  })
})
