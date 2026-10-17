import { describe, it, expect } from 'vitest'
import { aiOutputSchema, buildAiSections } from '@/lib/landing/ai'
import { sectionTemplates } from '@/lib/landing/templates'

const TODAY = '2026-10-16'
const ids = sectionTemplates(TODAY).map((t) => t.id) as [string, ...string[]]

describe('AI 출력 스키마', () => {
  it('[보안] 템플릿 목록 밖 id·URL 필드는 스키마가 거부/무시', () => {
    const schema = aiOutputSchema(ids)
    expect(schema.safeParse({ sections: [{ templateId: 'evil', text: {} }] }).success).toBe(false)
    const parsed = schema.parse({ sections: [{ templateId: 'donate-cta', text: { headline: '함께해요', buttonUrl: 'javascript:alert(1)' } }] })
    expect('buttonUrl' in parsed.sections[0].text).toBe(false)
  })
})

describe('buildAiSections', () => {
  it('문구만 템플릿 자리에 넣고 URL·이미지·기간은 템플릿 값을 유지', () => {
    const { sections } = buildAiSections(
      {
        sections: [
          { templateId: 'monthly-hero', text: { headline: '아이들의 내일을 함께', buttonText: '정기후원 하기' } },
          { templateId: 'yearend-cta', text: { headline: '올해가 가기 전에', body: '세액공제도 받을 수 있어요.' } },
        ],
      },
      TODAY,
    )
    const hero = sections[0].data as Record<string, unknown>
    expect(hero.headline).toBe('아이들의 내일을 함께')
    expect(hero.ctaText).toBe('정기후원 하기')
    expect(hero.bgImageUrl).toBe('/img/landing/hero-monthly.webp')
    expect(hero.ctaUrl).toBe('#campaigns')
    const cta = sections[1].data as Record<string, unknown>
    expect(cta.schedule).toEqual({ from: TODAY, until: '2026-12-31' })
  })

  it('빈 문구는 템플릿 기본 문구로 남고, FAQ는 비어 있지 않은 항목만', () => {
    const { sections } = buildAiSections(
      { sections: [{ templateId: 'giving-faq', text: { faq: [{ q: '영수증?', a: '1월에 보내드려요.' }, { q: ' ', a: '' }] } }] },
      TODAY,
    )
    const faq = sections[0].data as { items: Array<{ q: string }> }
    expect(faq.items).toEqual([{ q: '영수증?', a: '1월에 보내드려요.' }])
  })

  it('검증 실패 섹션은 버리고 개수를 알린다', () => {
    // 헤드라인 100자 초과 → hero 스키마 실패
    const { sections, dropped } = buildAiSections(
      { sections: [{ templateId: 'monthly-hero', text: { headline: 'x'.repeat(100) + '!' } }, { templateId: 'donate-cta', text: {} }] },
      TODAY,
    )
    expect(dropped).toBe(1)
    expect(sections.map((s) => s.type)).toEqual(['cta'])
    expect(sections[0].sortOrder).toBe(0)
  })
})
