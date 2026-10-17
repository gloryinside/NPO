import { describe, it, expect } from 'vitest'
import { safeLinkUrl, safeImageUrl, sanitizeSectionUrls } from '@/lib/landing/url-safety'
import { collectImageUrls, orphanStoragePaths } from '@/lib/landing/assets'
import { auditLanding } from '@/lib/landing/audit'
import type { LandingSection } from '@/types/landing'

const ORG = '11111111-1111-1111-1111-111111111111'
const pub = (p: string) => `https://x.supabase.co/storage/v1/object/public/campaign-assets/${p}`
const sec = (data: Record<string, unknown>, extra: Partial<LandingSection> = {}): LandingSection =>
  ({ id: 's1', type: 'gallery', variant: 'gallery-grid', sortOrder: 0, isVisible: true, data, ...extra }) as LandingSection

describe('safeLinkUrl', () => {
  it('허용: http(s)·내부 경로·앵커·mailto/tel', () => {
    for (const u of ['https://a.org/x', '/donate', '#campaigns', 'mailto:a@b.org', 'tel:02-123-4567'])
      expect(safeLinkUrl(u)).toBe(u)
  })
  it('차단: javascript:/data:/프로토콜-상대', () => {
    for (const u of ['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', '//evil.com', 'vbscript:x'])
      expect(safeLinkUrl(u)).toBeNull()
  })
})

describe('safeImageUrl', () => {
  it('확장자 없는 CDN URL도 허용', () => {
    expect(safeImageUrl('https://picsum.photos/seed/a/800/600')).not.toBeNull()
  })
  it('javascript:·경로 우회 차단', () => {
    expect(safeImageUrl('javascript:alert(1)')).toBeNull()
    expect(safeImageUrl('/img/../secret.png')).toBeNull()
  })
})

describe('sanitizeSectionUrls', () => {
  it('중첩된 링크·이미지를 종류별로 정리하고 원본은 바꾸지 않는다', () => {
    const data = {
      buttonUrl: 'javascript:alert(1)',
      ctaUrl: '#campaigns',
      images: [{ url: 'javascript:x', alt: 'a' }, { url: 'https://ok/1.webp', alt: 'b' }],
      logos: [{ name: 'A', imageUrl: 'https://ok/l.png', url: 'javascript:y' }],
      headline: 'javascript: 는 문구일 뿐',
    }
    const out = sanitizeSectionUrls(data)
    expect(out.buttonUrl).toBe('')
    expect(out.ctaUrl).toBe('#campaigns')
    expect(out.images[0].url).toBe('')
    expect(out.images[1].url).toBe('https://ok/1.webp')
    expect(out.logos[0].url).toBe('')
    expect(out.logos[0].imageUrl).toBe('https://ok/l.png')
    expect(out.headline).toBe('javascript: 는 문구일 뿐')
    expect(data.buttonUrl).toBe('javascript:alert(1)')
  })
})

describe('orphanStoragePaths', () => {
  const a = pub(`${ORG}/landing/2026-10/a.webp`)
  const b = pub(`${ORG}/landing/2026-10/b.webp`)
  const c = pub(`${ORG}/landing/2026-10/c.webp`)

  it('배열 안 이미지까지 수집한다', () => {
    expect(collectImageUrls([sec({ images: [{ url: a, alt: '' }] })]).has(a)).toBe(true)
  })

  it('게시 중이거나 이력에 있는 이미지는 지우지 않는다', () => {
    const prevDraft = { sections: [sec({ images: [{ url: a }, { url: b }, { url: c }] })] }
    const newDraft = { sections: [] }
    const published = { sections: [sec({ bgImageUrl: a })] }
    const history = { sections: [sec({ logos: [{ imageUrl: b }] })] }
    expect(orphanStoragePaths(ORG, prevDraft, [newDraft, published, history])).toEqual([
      `${ORG}/landing/2026-10/c.webp`,
    ])
  })

  it('다른 기관 파일은 절대 포함하지 않는다', () => {
    const other = pub('22222222-2222-2222-2222-222222222222/landing/x.webp')
    expect(orphanStoragePaths(ORG, { sections: [sec({ imageUrl: other })] }, [])).toEqual([])
  })
})

describe('auditLanding', () => {
  it('견본 이미지·영상과 위험 주소를 찾는다', () => {
    const codes = auditLanding([
      sec({ images: [{ url: 'https://picsum.photos/seed/a/800/600', alt: 'a' }], ctaUrl: 'javascript:x' }),
    ]).map((f) => f.code)
    expect(codes).toContain('placeholder')
    expect(codes).toContain('unsafe_url')
  })
  it('숨긴 섹션은 점검하지 않고, 보이는 섹션이 없으면 알린다', () => {
    const f = auditLanding([sec({ images: [{ url: 'https://picsum.photos/x', alt: '' }] }, { isVisible: false })])
    expect(f.map((x) => x.code)).toEqual(['no_visible_sections'])
  })
})
