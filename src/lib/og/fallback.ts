/**
 * G-123: OG 이미지 렌더 실패 fallback.
 *
 * next/og의 Satori 렌더가 예외를 던지거나 DB 조회가 깨졌을 때도 200을
 * 반환해 카톡/페북 크롤러가 "빈 미리보기"를 띄우는 것을 막는다.
 *
 * SVG 문자열을 인라인 생성 — 별도 정적 자산 불필요. 텍스트/배경만으로
 * 1200×630 카드를 그리고, 그 외 의존성은 없다 (Satori 자체가 죽어도
 * 여기는 영향 없음).
 */

export interface FallbackOgOptions {
  headline?: string
  subhead?: string
  /** 배경 gradient: [from, to] 16진수 */
  gradient?: [string, string]
}

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function buildFallbackOgSvg(opts: FallbackOgOptions = {}): string {
  const headline = escapeXml(opts.headline ?? '함께 후원해요')
  const subhead = escapeXml(opts.subhead ?? '')
  const [from, to] = opts.gradient ?? ['#1e3a8a', '#7c3aed']

  const subheadBlock = subhead
    ? `<text x="600" y="400" font-family="sans-serif" font-size="36" font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle">${subhead}</text>`
    : ''

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <text x="600" y="260" font-family="sans-serif" font-size="32" fill="rgba(255,255,255,0.85)" text-anchor="middle" letter-spacing="4">💌</text>
  <text x="600" y="330" font-family="sans-serif" font-size="68" font-weight="800" fill="white" text-anchor="middle">${headline}</text>
  ${subheadBlock}
</svg>`
}

/** fallback SVG를 공용 캐시 헤더와 함께 Response로 포장. */
export function fallbackOgResponse(opts: FallbackOgOptions = {}): Response {
  const svg = buildFallbackOgSvg(opts)
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      // SVG fallback은 1시간만 캐시 — 렌더가 다시 정상화되면 빠르게 전환되도록
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
