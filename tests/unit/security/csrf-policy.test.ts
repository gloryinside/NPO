import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { requiresCsrfCheck } from '@/lib/security/csrf'
import { proxy } from '@/proxy'
import { vi } from 'vitest'

vi.mock('@/lib/tenant/resolver', () => ({ resolveTenant: vi.fn(async () => null) }))

describe('CSRF 정책(proxy 일괄 적용)', () => {
  it('데이터를 바꾸는 API만 대상', () => {
    expect(requiresCsrfCheck('/api/admin/payments/1', 'PATCH')).toBe(true)
    expect(requiresCsrfCheck('/api/donor/profile', 'post')).toBe(true)
    expect(requiresCsrfCheck('/api/donations/prepare', 'POST')).toBe(true)
    expect(requiresCsrfCheck('/api/admin/payments', 'GET')).toBe(false)
    expect(requiresCsrfCheck('/admin/settings', 'POST')).toBe(false)
  })

  it('다른 서버가 부르는 API는 제외(자체 인증)', () => {
    expect(requiresCsrfCheck('/api/webhooks/toss', 'POST')).toBe(false)
    expect(requiresCsrfCheck('/api/cron/charge', 'POST')).toBe(false)
    expect(requiresCsrfCheck('/api/v1/members', 'POST')).toBe(false)
    expect(requiresCsrfCheck('/api/donations/abc/webhooks', 'POST')).toBe(false)
    // 이름만 비슷한 경로는 제외되지 않는다
    expect(requiresCsrfCheck('/api/v10/x', 'POST')).toBe(true)
    expect(requiresCsrfCheck('/api/cronjob', 'POST')).toBe(true)
  })

  it('다른 사이트에서 온 관리자 API 요청은 proxy에서 403', async () => {
    const req = (origin: string) =>
      new NextRequest('https://hope.example.org/api/admin/chargebacks', {
        method: 'POST',
        headers: { host: 'hope.example.org', origin },
      })
    expect((await proxy(req('https://evil.test'))).status).toBe(403)
    expect((await proxy(req('https://hope.example.org'))).status).not.toBe(403)
  })
})
