import { describe, it, expect, vi } from 'vitest'

const org = vi.hoisted(() => ({ required: false }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { admin_mfa_required: org.required } }) }) }) }),
  }),
}))

import { adminMfaState, decideAdminMfa, mfaRequiredBody } from '@/lib/auth/admin-mfa'

const session = (currentLevel: string, nextLevel: string, error: unknown = null) =>
  ({ auth: { mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel, nextLevel }, error }) } } }) as never

describe('관리자 2단계 인증 판정', () => {
  it('코드까지 마친 세션은 통과', () => {
    expect(decideAdminMfa({ currentLevel: 'aal2', nextLevel: 'aal2', orgRequires: true })).toBe('ok')
  })

  it('OTP 앱을 등록했는데 코드를 안 넣었으면 코드 입력', () => {
    expect(decideAdminMfa({ currentLevel: 'aal1', nextLevel: 'aal2', orgRequires: false })).toBe('challenge')
  })

  it('등록 안 한 관리자: 기관이 필수로 켰을 때만 등록 요구', () => {
    expect(decideAdminMfa({ currentLevel: 'aal1', nextLevel: 'aal1', orgRequires: false })).toBe('ok')
    expect(decideAdminMfa({ currentLevel: 'aal1', nextLevel: 'aal1', orgRequires: true })).toBe('enroll')
  })

  it('세션에서 읽고, 필요할 때만 기관 설정을 본다', async () => {
    org.required = true
    expect(await adminMfaState(session('aal1', 'aal1'), 'o1')).toBe('enroll')
    org.required = false
    expect(await adminMfaState(session('aal1', 'aal1'), 'o1')).toBe('ok')
    expect(await adminMfaState(session('aal1', 'aal2'), 'o1')).toBe('challenge')
    expect(await adminMfaState(session('aal2', 'aal2'), 'o1')).toBe('ok')
  })

  it('판정에 실패하면 통과시키지 않는다', async () => {
    expect(await adminMfaState(session('aal1', 'aal1', new Error('x')), 'o1')).toBe('challenge')
  })

  it('API 응답은 이동할 화면을 알려 준다', () => {
    expect(mfaRequiredBody('enroll')).toMatchObject({ code: 'MFA_REQUIRED', next: '/admin/mfa/setup' })
    expect(mfaRequiredBody('challenge')).toMatchObject({ code: 'MFA_REQUIRED', next: '/admin/mfa' })
  })
})
