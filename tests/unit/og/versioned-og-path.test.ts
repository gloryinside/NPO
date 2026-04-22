import { describe, it, expect } from 'vitest'
import { buildVersionedOgPath } from '@/components/donor/impact/ImpactShareActions'

describe('buildVersionedOgPath (G-120)', () => {
  it('cacheVersion이 null이면 원 경로 유지', () => {
    expect(buildVersionedOgPath('/api/donor/impact/og', null)).toBe(
      '/api/donor/impact/og',
    )
  })

  it('cacheVersion이 undefined여도 원 경로 유지', () => {
    expect(buildVersionedOgPath('/api/donor/impact/og', undefined)).toBe(
      '/api/donor/impact/og',
    )
  })

  it('빈 문자열 cacheVersion은 falsy로 취급 (원 경로 유지)', () => {
    expect(buildVersionedOgPath('/api/donor/impact/og', '')).toBe(
      '/api/donor/impact/og',
    )
  })

  it('YYYY-MM-DD 날짜 → ?v= 붙음', () => {
    expect(buildVersionedOgPath('/api/donor/impact/og', '2026-04-23')).toBe(
      '/api/donor/impact/og?v=2026-04-23',
    )
  })

  it('ISO timestamp의 콜론은 URL-encode', () => {
    expect(
      buildVersionedOgPath('/api/donor/impact/og', '2026-04-23T10:30:00Z'),
    ).toBe('/api/donor/impact/og?v=2026-04-23T10%3A30%3A00Z')
  })

  it('기존 쿼리 있으면 & separator 사용', () => {
    expect(
      buildVersionedOgPath('/api/donor/impact/og?style=dark', '2026-04-23'),
    ).toBe('/api/donor/impact/og?style=dark&v=2026-04-23')
  })

  it('같은 cacheVersion이면 결과 동일 (idempotent)', () => {
    const a = buildVersionedOgPath('/api/donor/impact/og', '2026-04-23')
    const b = buildVersionedOgPath('/api/donor/impact/og', '2026-04-23')
    expect(a).toBe(b)
  })

  it('다른 cacheVersion이면 결과 다름 (캐시 자연 무효화 핵심)', () => {
    const a = buildVersionedOgPath('/api/donor/impact/og', '2026-04-22')
    const b = buildVersionedOgPath('/api/donor/impact/og', '2026-04-23')
    expect(a).not.toBe(b)
  })
})
