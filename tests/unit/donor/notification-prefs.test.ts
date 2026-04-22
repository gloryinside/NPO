import { describe, it, expect, vi } from 'vitest'
import {
  parseNotificationPrefs,
  getNotificationPrefs,
  updateNotificationPrefs,
  DEFAULT_NOTIFICATION_PREFS,
} from '@/lib/donor/notification-prefs'
import type { SupabaseClient } from '@supabase/supabase-js'

function selectStub(raw: unknown) {
  const chain: Record<string, unknown> = {}
  const ret = () => chain
  chain.select = ret
  chain.eq = ret
  chain.maybeSingle = () =>
    Promise.resolve({ data: { notification_prefs: raw }, error: null })
  return {
    from: vi.fn().mockReturnValue(chain),
  } as unknown as SupabaseClient
}

function updateStub(raw: unknown, updateError: unknown = null) {
  const selectChain: Record<string, unknown> = {}
  const retS = () => selectChain
  selectChain.select = retS
  selectChain.eq = retS
  selectChain.maybeSingle = () =>
    Promise.resolve({ data: { notification_prefs: raw }, error: null })

  const updateChain: Record<string, unknown> = {}
  updateChain.eq = () => Promise.resolve({ error: updateError })

  let callIndex = 0
  return {
    from: vi.fn().mockImplementation(() => {
      callIndex += 1
      if (callIndex === 1) {
        return {
          ...selectChain,
          update: () => updateChain,
        }
      }
      return {
        ...selectChain,
        update: () => updateChain,
      }
    }),
  } as unknown as SupabaseClient
}

describe('parseNotificationPrefs', () => {
  it('null/undefined는 기본값', () => {
    expect(parseNotificationPrefs(null)).toEqual(DEFAULT_NOTIFICATION_PREFS)
    expect(parseNotificationPrefs(undefined)).toEqual(
      DEFAULT_NOTIFICATION_PREFS
    )
  })
  it('빈 객체는 기본값', () => {
    expect(parseNotificationPrefs({})).toEqual(DEFAULT_NOTIFICATION_PREFS)
  })
  it('amount_change false는 유지', () => {
    expect(parseNotificationPrefs({ amount_change: false })).toEqual({
      amount_change: false,
    })
  })
  it('잘못된 타입은 기본값 fallback', () => {
    expect(parseNotificationPrefs({ amount_change: 'no' })).toEqual(
      DEFAULT_NOTIFICATION_PREFS
    )
  })
})

describe('getNotificationPrefs', () => {
  it('없는 회원은 기본값', async () => {
    const s = selectStub(null)
    expect(await getNotificationPrefs(s, 'm1')).toEqual(
      DEFAULT_NOTIFICATION_PREFS
    )
  })
  it('있으면 파싱 결과', async () => {
    const s = selectStub({ amount_change: false })
    expect(await getNotificationPrefs(s, 'm1')).toEqual({
      amount_change: false,
    })
  })
})

describe('updateNotificationPrefs', () => {
  it('partial merge 적용', async () => {
    const s = updateStub({ amount_change: true })
    const r = await updateNotificationPrefs(s, 'm1', { amount_change: false })
    expect(r).toEqual({ amount_change: false })
  })
  it('update 실패 시 null', async () => {
    const s = updateStub({}, { message: 'db' })
    const r = await updateNotificationPrefs(s, 'm1', { amount_change: false })
    expect(r).toBeNull()
  })
})
