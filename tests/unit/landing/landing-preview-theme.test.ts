import { describe, it, expect } from 'vitest'
import { ThemeConfigSchema, themeConfigToCss } from '@/lib/theme/config'
import { parseToFrame, parseFromFrame } from '@/lib/landing/preview-protocol'

describe('ThemeConfigSchema — <style> 탈출 방지', () => {
  it('색 형식만 허용한다', () => {
    expect(ThemeConfigSchema.safeParse({ accent: '#009944', accentSoft: 'rgba(0,153,68,0.12)' }).success).toBe(true)
    expect(ThemeConfigSchema.safeParse({ accent: 'red;}</style><script>alert(1)</script>' }).success).toBe(false)
    expect(ThemeConfigSchema.safeParse({ bg: '#fff;} body{display:none' }).success).toBe(false)
  })
  it('검증된 설정으로 만든 CSS에는 태그가 들어갈 수 없다', () => {
    const css = themeConfigToCss(ThemeConfigSchema.parse({}))
    expect(css).not.toContain('<')
  })
})

describe('preview protocol', () => {
  it('형식이 맞는 상태만 받는다', () => {
    expect(parseToFrame({ kind: 'other' })).toBeNull()
    const st = parseToFrame({
      kind: 'npo-landing-preview-state',
      state: { sections: [{ id: 'a', type: 'hero', variant: 'hero-minimal', data: { headline: 'x' } }, { bad: 1 }], selectedId: 'a', theme: 'dark' },
    })
    expect(st?.sections).toHaveLength(1)
    expect(st?.sections[0].isVisible).toBe(true)
    expect(st?.theme).toBe('dark')
  })
  it('선택 이벤트 id 길이를 제한한다', () => {
    expect(parseFromFrame({ kind: 'npo-landing-preview-select', id: 'x'.repeat(101) })).toBeNull()
    expect(parseFromFrame({ kind: 'npo-landing-preview-select', id: 's1' })).toEqual({ kind: 'npo-landing-preview-select', id: 's1' })
  })
})
