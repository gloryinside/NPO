import { describe, it, expect, vi } from 'vitest'
import { getOrgSettings, updateOrgSettings, DEFAULT_ORG_SETTINGS } from '@/lib/org/settings'
import type { SupabaseClient } from '@supabase/supabase-js'

function readStub(settings: unknown) {
  const chain: Record<string, unknown> = {}
  chain.select = () => chain
  chain.eq = () => chain
  chain.maybeSingle = () => Promise.resolve({ data: { settings } })
  return { from: vi.fn().mockReturnValue(chain) } as unknown as SupabaseClient
}

function readUpdateStub(settings: unknown, updateResult: { error?: { message: string } } = {}) {
  const readChain: Record<string, unknown> = {}
  readChain.select = () => readChain
  readChain.eq = () => readChain
  readChain.maybeSingle = () => Promise.resolve({ data: { settings } })

  const updateChain: Record<string, unknown> = {}
  updateChain.update = vi.fn().mockImplementation(() => updateChain)
  updateChain.eq = () => Promise.resolve(updateResult)

  const from = vi.fn().mockImplementation(() => {
    // 첫 호출 = read, 두 번째 호출 = update
    if (from.mock.calls.length === 1) return readChain
    return updateChain
  })
  return { from } as unknown as SupabaseClient
}

describe('getOrgSettings', () => {
  it('settings가 NULL이면 모두 기본값', async () => {
    const s = await getOrgSettings(readStub(null), 'org-1')
    expect(s).toEqual(DEFAULT_ORG_SETTINGS)
  })

  it('부분 설정은 기본값과 병합', async () => {
    const s = await getOrgSettings(readStub({ weekly_alert_enabled: false }), 'org-1')
    expect(s.weekly_alert_enabled).toBe(false)
    expect(s.impact_unit_amount).toBe(100_000)   // 기본
    expect(s.campaign_thanks_enabled).toBe(true) // 기본
  })

  it('impact_unit_amount가 0 이하면 기본값 사용', async () => {
    const s = await getOrgSettings(readStub({ impact_unit_amount: 0 }), 'org-1')
    expect(s.impact_unit_amount).toBe(100_000)
  })

  it('impact_unit_amount가 문자열이면 기본값 사용', async () => {
    const s = await getOrgSettings(readStub({ impact_unit_amount: 'abc' }), 'org-1')
    expect(s.impact_unit_amount).toBe(100_000)
  })
})

describe('updateOrgSettings', () => {
  it('부분 업데이트는 기존값과 병합', async () => {
    const s = readUpdateStub({ impact_unit_amount: 50_000 })
    const r = await updateOrgSettings(s, 'org-1', { weekly_alert_enabled: false })
    expect(r.ok).toBe(true)
    expect(r.settings?.weekly_alert_enabled).toBe(false)
    expect(r.settings?.impact_unit_amount).toBe(50_000)
  })

  it('impact_unit_amount가 0이면 거부', async () => {
    const s = readUpdateStub({})
    const r = await updateOrgSettings(s, 'org-1', { impact_unit_amount: 0 })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/positive/)
  })

  it('DB 에러 시 실패 반환', async () => {
    const s = readUpdateStub({}, { error: { message: 'conn refused' } })
    const r = await updateOrgSettings(s, 'org-1', { weekly_alert_enabled: true })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('conn refused')
  })
})
