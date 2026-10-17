import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

const eqCalls: Array<[string, unknown]> = []
vi.mock('@/lib/auth/api-guard', () => ({
  requireAdminApi: vi.fn(async () => ({ ok: true, ctx: { tenant: { id: 'org-A' }, user: { id: 'admin-A' } } })),
}))
vi.mock('@/lib/audit', () => ({ logAudit: vi.fn(async () => {}) }))
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({
    from: () => {
      const q = {
        select: () => q,
        eq: (k: string, v: unknown) => (eqCalls.push([k, v]), q),
        // 다른 기관 후원자 → 조회 결과 없음
        maybeSingle: async () => ({ data: null, error: null }),
      }
      return q
    },
    auth: { admin: { mfa: { listFactors: vi.fn(), deleteFactor: vi.fn() } } },
  }),
}))

import { POST } from '@/app/api/admin/members/[id]/mfa-reset/route'

describe('POST /api/admin/members/[id]/mfa-reset', () => {
  it('이 기관 후원자로만 찾는다 — 다른 기관 후원자는 404', async () => {
    const res = await POST(new NextRequest('http://x/api/admin/members/m-B/mfa-reset', { method: 'POST' }), {
      params: Promise.resolve({ id: 'm-B' }),
    })
    expect(res.status).toBe(404)
    expect(eqCalls).toContainEqual(['org_id', 'org-A'])
  })
})
