import { describe, it, expect } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { adminClaims, isAdminOfTenant } from '@/lib/auth/tenant-binding'

const ORG_A = '8ca9a653-f788-450d-a114-ac336e11f94d'
const ORG_B = '11111111-1111-1111-1111-111111111111'
const user = (app: Record<string, unknown>, meta: Record<string, unknown> = {}) =>
  ({ id: 'u', app_metadata: app, user_metadata: meta }) as unknown as User

describe('관리자 권한 판정', () => {
  it('app_metadata의 역할·소속만 인정한다', () => {
    expect(adminClaims(user({ role: 'admin', org_id: ORG_A }))).toEqual({ role: 'admin', orgId: ORG_A })
    expect(isAdminOfTenant(user({ role: 'admin', org_id: ORG_A }), ORG_A)).toBe(true)
  })

  it('[보안] 사용자가 직접 바꾼 user_metadata로는 관리자가 될 수 없다', () => {
    const escalated = user({}, { role: 'admin', org_id: ORG_A })
    expect(adminClaims(escalated)).toBeNull()
    expect(isAdminOfTenant(escalated, ORG_A)).toBe(false)
  })

  it('[보안] 다른 기관 관리자는 이 기관에서 관리자가 아니다', () => {
    expect(isAdminOfTenant(user({ role: 'admin', org_id: ORG_A }), ORG_B)).toBe(false)
  })

  it('테넌트를 모르면 거부', () => {
    expect(isAdminOfTenant(user({ role: 'admin', org_id: ORG_A }), null)).toBe(false)
    expect(isAdminOfTenant(null, ORG_A)).toBe(false)
  })
})
