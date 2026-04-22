import { describe, it, expect } from 'vitest'
import { normalizeIpForKey } from '@/lib/rate-limit'

describe('normalizeIpForKey (G-113)', () => {
  describe('fallback cases', () => {
    it.each(['', '   ', 'unknown'])('빈/unknown %j → unknown', (input) => {
      expect(normalizeIpForKey(input)).toBe('unknown')
    })
  })

  describe('IPv4 (그대로 유지)', () => {
    it.each([
      '203.0.113.5',
      '10.0.0.1',
      '192.168.1.1',
      '255.255.255.255',
    ])('%s → 동일', (ip) => {
      expect(normalizeIpForKey(ip)).toBe(ip)
    })

    it('trim 적용', () => {
      expect(normalizeIpForKey('  203.0.113.5  ')).toBe('203.0.113.5')
    })
  })

  describe('IPv4-mapped IPv6 (내부 v4만 추출)', () => {
    it.each([
      ['::ffff:203.0.113.5', '203.0.113.5'],
      ['::FFFF:10.0.0.1', '10.0.0.1'],
    ])('%s → %s', (input, expected) => {
      expect(normalizeIpForKey(input)).toBe(expected)
    })
  })

  describe('IPv6 /64 마스킹', () => {
    it('완전 주소는 앞 4 hextets만 유지', () => {
      expect(normalizeIpForKey('2001:db8:1234:5678:abcd:ef01:2345:6789')).toBe(
        '2001:db8:1234:5678::/64',
      )
    })

    it('같은 /64 대역의 두 주소는 동일 키로 매핑 (우회 방지 핵심)', () => {
      const a = normalizeIpForKey('2001:db8:aa:bb:1111:2222:3333:4444')
      const b = normalizeIpForKey('2001:db8:aa:bb:9999:8888:7777:6666')
      expect(a).toBe(b)
      expect(a).toBe('2001:db8:aa:bb::/64')
    })

    it('다른 /64 대역은 다른 키', () => {
      const a = normalizeIpForKey('2001:db8:aa:bb::1')
      const b = normalizeIpForKey('2001:db8:aa:cc::1')
      expect(a).not.toBe(b)
    })

    it('zero-compression "::" 포함 주소 처리', () => {
      expect(normalizeIpForKey('2001:db8::1')).toBe('2001:db8:0:0::/64')
    })

    it('loopback ::1', () => {
      expect(normalizeIpForKey('::1')).toBe('0:0:0:0::/64')
    })

    it('대소문자 정규화 (소문자로 통일)', () => {
      expect(normalizeIpForKey('2001:DB8:AA:BB::1')).toBe('2001:db8:aa:bb::/64')
    })
  })
})
