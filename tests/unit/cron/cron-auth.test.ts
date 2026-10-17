import { describe, it, expect, afterEach, vi } from 'vitest'
import { cronAuthError, cronSecretMatches } from '@/lib/cron/runner'

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers })

describe('크론 인증', () => {
  afterEach(() => vi.unstubAllEnvs())

  it('Bearer·x-cron-secret 헤더만 받는다', () => {
    expect(cronSecretMatches(req('http://x/api/cron/a', { authorization: 'Bearer s3cret' }), 's3cret')).toBe(true)
    expect(cronSecretMatches(req('http://x/api/cron/a', { 'x-cron-secret': 's3cret' }), 's3cret')).toBe(true)
  })

  it('[보안] URL 쿼리 토큰은 받지 않는다(로그·기록에 남음)', () => {
    expect(cronSecretMatches(req('http://x/api/cron/a?token=s3cret'), 's3cret')).toBe(false)
  })

  it('[보안] CRON_SECRET이 없으면 개발 환경에서도 거부', () => {
    vi.stubEnv('CRON_SECRET', '')
    vi.stubEnv('NODE_ENV', 'development')
    expect(cronAuthError(req('http://x/api/cron/a'))?.status).toBe(500)
  })

  it('틀린 비밀은 401, 맞으면 통과(null)', () => {
    vi.stubEnv('CRON_SECRET', 's3cret')
    expect(cronAuthError(req('http://x/api/cron/a', { authorization: 'Bearer nope' }))?.status).toBe(401)
    expect(cronAuthError(req('http://x/api/cron/a', { authorization: 'Bearer s3cret' }))).toBeNull()
  })
})
