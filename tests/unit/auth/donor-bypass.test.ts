import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BYPASS_FIXED_CODE,
  classifyIdentifier,
  isDonorAuthBypassEnabled,
} from '@/lib/auth/donor-bypass'

describe('classifyIdentifier', () => {
  it.each([
    [' user@example.com ', { kind: 'email', value: 'user@example.com' }],
    ['MixedCase@EXAMPLE.COM', { kind: 'email', value: 'mixedcase@example.com' }],
    ['a@b.c', { kind: 'email', value: 'a@b.c' }],
  ])('이메일 %j → %o', (input, expected) => {
    expect(classifyIdentifier(input)).toEqual(expected)
  })

  it.each([
    ['010-1234-5678', { kind: 'phone', value: '01012345678' }],
    ['010 1234 5678', { kind: 'phone', value: '01012345678' }],
    ['+82 10 1234 5678', { kind: 'phone', value: '821012345678' }],
    ['1234', { kind: 'phone', value: '1234' }],
  ])('전화번호 %j → %o', (input, expected) => {
    expect(classifyIdentifier(input)).toEqual(expected)
  })

  it.each(['', '   ', '123', 'abc'])(
    '무효 입력 %j → null',
    (input) => {
      expect(classifyIdentifier(input)).toBeNull()
    },
  )
})

describe('isDonorAuthBypassEnabled', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_DONOR_AUTH_BYPASS', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('기본값(환경변수 미설정): 비활성', () => {
    expect(isDonorAuthBypassEnabled()).toBe(false)
  })

  it('NEXT_PUBLIC_DONOR_AUTH_BYPASS=1 + dev → 활성', () => {
    vi.stubEnv('NEXT_PUBLIC_DONOR_AUTH_BYPASS', '1')
    expect(isDonorAuthBypassEnabled()).toBe(true)
  })

  it('환경변수 아무 값(=1 아님)은 비활성', () => {
    vi.stubEnv('NEXT_PUBLIC_DONOR_AUTH_BYPASS', 'true')
    expect(isDonorAuthBypassEnabled()).toBe(false)
  })

  it('production에서는 환경변수 1이어도 비활성 (이중 가드)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_DONOR_AUTH_BYPASS', '1')
    expect(isDonorAuthBypassEnabled()).toBe(false)
  })
})

describe('BYPASS_FIXED_CODE', () => {
  it('6자리 숫자', () => {
    expect(BYPASS_FIXED_CODE).toMatch(/^\d{6}$/)
  })
})
