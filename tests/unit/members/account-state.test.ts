import { describe, it, expect, vi } from 'vitest'
import {
  resolveAccountState,
  resolveAccountStatesBatch,
  DEFAULT_INVITE_WINDOW_DAYS,
} from '@/lib/members/account-state'
import type { SupabaseClient } from '@supabase/supabase-js'

/** 최신 1건 maybeSingle 쿼리용 stub */
function singleInviteStub(sentAt: string | null) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = ret
  chain.order = ret
  chain.limit = ret
  chain.maybeSingle = () =>
    Promise.resolve({
      data: sentAt ? { sent_at: sentAt } : null,
      error: null,
    })
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

/** 배치 쿼리용 stub — .in() 호출 후 바로 array 반환 */
function batchInviteStub(rows: Array<{ ref_id: string; sent_at: string }>) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.in = ret
  chain.eq = ret
  chain.order = () => Promise.resolve({ data: rows, error: null })
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

describe('resolveAccountState', () => {
  it('supabase_uid가 있으면 linked (DB 쿼리 없음)', async () => {
    const sb = {
      from: vi.fn(() => {
        throw new Error('should not hit DB')
      }),
    } as unknown as SupabaseClient
    const r = await resolveAccountState(sb, 'm1', {
      supabaseUid: 'uid-abc',
    })
    expect(r).toBe('linked')
  })

  it('비회원 + invite 이력 없음 → unlinked', async () => {
    const sb = singleInviteStub(null)
    const r = await resolveAccountState(sb, 'm1', { supabaseUid: null })
    expect(r).toBe('unlinked')
  })

  it('비회원 + 최근 5일 전 invite → invited', async () => {
    const sentAt = new Date(Date.now() - 5 * 86_400_000).toISOString()
    const sb = singleInviteStub(sentAt)
    const r = await resolveAccountState(sb, 'm1', { supabaseUid: null })
    expect(r).toBe('invited')
  })

  it('비회원 + 40일 전 invite → invite_expired (default 30일 윈도우)', async () => {
    const sentAt = new Date(Date.now() - 40 * 86_400_000).toISOString()
    const sb = singleInviteStub(sentAt)
    const r = await resolveAccountState(sb, 'm1', { supabaseUid: null })
    expect(r).toBe('invite_expired')
  })

  it('inviteWindowDays=7 override 동작', async () => {
    const sentAt = new Date(Date.now() - 10 * 86_400_000).toISOString()
    const sb = singleInviteStub(sentAt)
    const r = await resolveAccountState(sb, 'm1', {
      supabaseUid: null,
      inviteWindowDays: 7,
    })
    expect(r).toBe('invite_expired')
  })
})

describe('resolveAccountStatesBatch', () => {
  it('빈 배열 → 빈 Map, DB 쿼리 없음', async () => {
    const sb = {
      from: vi.fn(() => {
        throw new Error('should not hit DB')
      }),
    } as unknown as SupabaseClient
    const r = await resolveAccountStatesBatch(sb, [])
    expect(r.size).toBe(0)
  })

  it('전원 linked인 경우 DB 쿼리 없음', async () => {
    const sb = {
      from: vi.fn(() => {
        throw new Error('should not hit DB')
      }),
    } as unknown as SupabaseClient
    const r = await resolveAccountStatesBatch(sb, [
      { id: 'a', supabase_uid: 'u1' },
      { id: 'b', supabase_uid: 'u2' },
    ])
    expect(r.get('a')?.state).toBe('linked')
    expect(r.get('b')?.state).toBe('linked')
  })

  it('혼합 4상태를 올바르게 계산', async () => {
    const now = Date.now()
    const recent = new Date(now - 5 * 86_400_000).toISOString()
    const expired = new Date(now - 40 * 86_400_000).toISOString()

    const sb = batchInviteStub([
      { ref_id: 'recent-invited', sent_at: recent },
      { ref_id: 'old-invite', sent_at: expired },
      // 'no-invite' 이력 없음 → unlinked
      // 'linked1' 은 선단락되어 배치 쿼리 포함 안 됨
    ])

    const r = await resolveAccountStatesBatch(sb, [
      { id: 'linked1', supabase_uid: 'uid' },
      { id: 'recent-invited', supabase_uid: null },
      { id: 'old-invite', supabase_uid: null },
      { id: 'no-invite', supabase_uid: null },
    ])

    expect(r.get('linked1')?.state).toBe('linked')
    expect(r.get('recent-invited')?.state).toBe('invited')
    expect(r.get('recent-invited')?.lastInviteSentAt).toBe(recent)
    expect(r.get('old-invite')?.state).toBe('invite_expired')
    expect(r.get('no-invite')?.state).toBe('unlinked')
  })

  it('같은 ref_id에 여러 sent 이력 → 최신(첫 등장)을 사용', async () => {
    const now = Date.now()
    const newest = new Date(now - 2 * 86_400_000).toISOString()
    const older = new Date(now - 50 * 86_400_000).toISOString()

    // ORDER BY sent_at DESC 가정 — 첫 등장이 최신
    const sb = batchInviteStub([
      { ref_id: 'm1', sent_at: newest },
      { ref_id: 'm1', sent_at: older },
    ])

    const r = await resolveAccountStatesBatch(sb, [
      { id: 'm1', supabase_uid: null },
    ])

    expect(r.get('m1')?.state).toBe('invited')
    expect(r.get('m1')?.lastInviteSentAt).toBe(newest)
  })
})

describe('constants', () => {
  it('DEFAULT_INVITE_WINDOW_DAYS = 30', () => {
    expect(DEFAULT_INVITE_WINDOW_DAYS).toBe(30)
  })
})
