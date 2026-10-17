// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { decodeSignature, hashAgentToken, isTokenShape, newAgentToken, parseAgentInput } from '@/lib/f2f/agents'

describe('현장 모금 링크', () => {
  it('토큰은 32자 base64url, DB에는 해시만', () => {
    const { token, hash } = newAgentToken()
    expect(isTokenShape(token)).toBe(true)
    expect(hash).toBe(hashAgentToken(token))
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(newAgentToken().token).not.toBe(token)
    expect(isTokenShape('short')).toBe(false)
    expect(isTokenShape(`${'a'.repeat(31)}/`)).toBe(false)
    expect(isTokenShape(undefined)).toBe(false)
  })

  it('모금가 입력 검증', () => {
    const campaignId = '11111111-1111-4111-8111-111111111111'
    expect(parseAgentInput({ name: ' 김모금 ', code: 'SEOUL01', campaignId, days: 30 })).toEqual({
      ok: true, value: { name: '김모금', code: 'SEOUL01', campaignId, days: 30 },
    })
    expect(parseAgentInput({ name: '김', code: 'a b', campaignId }).ok).toBe(false)
    expect(parseAgentInput({ name: '', code: 'AB', campaignId }).ok).toBe(false)
    expect(parseAgentInput({ name: '김', code: 'AB', campaignId: 'x' }).ok).toBe(false)
    expect(parseAgentInput({ name: '김', code: 'AB', campaignId, days: 91 }).ok).toBe(false)
    expect(parseAgentInput({ name: '김', code: 'AB', campaignId }).ok).toBe(true) // 기본 30일
  })
})

describe('서명 이미지', () => {
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)])
  const url = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`

  it('PNG 만 받는다', () => {
    expect(decodeSignature(url(png))?.length).toBe(png.length)
    expect(decodeSignature(`data:image/jpeg;base64,${png.toString('base64')}`)).toBeNull()
    expect(decodeSignature(url(Buffer.alloc(208, 1)))).toBeNull() // 매직 바이트 없음
    expect(decodeSignature('data:image/png;base64,@@@')).toBeNull()
    expect(decodeSignature(42)).toBeNull()
  })

  it('너무 크면 거절', () => {
    const big = Buffer.concat([png, Buffer.alloc(400_001)])
    expect(decodeSignature(url(big))).toBeNull()
  })
})
