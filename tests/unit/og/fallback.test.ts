import { describe, it, expect } from 'vitest'
import { buildFallbackOgSvg, fallbackOgResponse } from '@/lib/og/fallback'

describe('buildFallbackOgSvg (G-123)', () => {
  it('기본 옵션: "함께 후원해요" headline + 기본 gradient', () => {
    const svg = buildFallbackOgSvg()
    expect(svg).toContain('width="1200"')
    expect(svg).toContain('height="630"')
    expect(svg).toContain('함께 후원해요')
    expect(svg).toContain('#1e3a8a')
    expect(svg).toContain('#7c3aed')
  })

  it('headline/subhead 커스텀', () => {
    const svg = buildFallbackOgSvg({
      headline: '나의 임팩트',
      subhead: '함께한 기록',
    })
    expect(svg).toContain('나의 임팩트')
    expect(svg).toContain('함께한 기록')
  })

  it('subhead 없으면 <text> 블록 생략', () => {
    const svg = buildFallbackOgSvg({ headline: '제목만' })
    expect(svg).toContain('제목만')
    // y="400" 서브헤드 좌표는 없어야 함
    expect(svg).not.toContain('y="400"')
  })

  it('gradient 옵션으로 색상 커스텀', () => {
    const svg = buildFallbackOgSvg({
      gradient: ['#ff0000', '#00ff00'],
    })
    expect(svg).toContain('#ff0000')
    expect(svg).toContain('#00ff00')
  })

  it('XML 특수문자 이스케이프 — headline에 < > & " \' 포함', () => {
    const svg = buildFallbackOgSvg({
      headline: '<script>alert("xss")</script>',
    })
    expect(svg).not.toContain('<script>')
    expect(svg).toContain('&lt;script&gt;')
    expect(svg).toContain('&quot;xss&quot;')
  })

  it('XML prolog로 시작해 파서에 안전한 형태', () => {
    const svg = buildFallbackOgSvg()
    expect(svg.trimStart().startsWith('<?xml')).toBe(true)
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
  })
})

describe('fallbackOgResponse', () => {
  it('Content-Type: image/svg+xml', async () => {
    const res = fallbackOgResponse()
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('image/svg+xml')
  })

  it('짧은 public 캐시 (1시간) — 렌더 정상화 시 빠르게 전환', () => {
    const res = fallbackOgResponse()
    expect(res.headers.get('Cache-Control')).toContain('public')
    expect(res.headers.get('Cache-Control')).toContain('max-age=3600')
  })

  it('body는 SVG 문자열', async () => {
    const res = fallbackOgResponse({ headline: '테스트' })
    const body = await res.text()
    expect(body).toContain('<svg')
    expect(body).toContain('테스트')
  })
})
