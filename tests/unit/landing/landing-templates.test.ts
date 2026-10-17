import { describe, it, expect } from 'vitest'
import { sectionTemplates, PAGE_BUNDLES, sectionFromTemplate, sectionsFromBundle } from '@/lib/landing/templates'
import { validateSections } from '@/lib/landing-variants/validate'
import { auditLanding } from '@/lib/landing/audit'
import { parseSchedule, scheduleState, shownOn, normalizeDisplayFields, scheduleLabel } from '@/lib/landing/display'

const TODAY = '2026-10-16'

describe('섹션 템플릿', () => {
  const templates = sectionTemplates(TODAY)

  it('모든 템플릿이 서버 검증을 통과', () => {
    const sections = templates.map((t, i) => sectionFromTemplate(t, i))
    expect(validateSections(sections)).toEqual([])
  })

  it('견본 이미지·위험 주소가 없어 게시 전 점검을 통과', () => {
    const sections = templates.map((t, i) => sectionFromTemplate(t, i))
    const bad = auditLanding(sections, TODAY).filter((f) => f.code === 'placeholder' || f.code === 'unsafe_url')
    expect(bad).toEqual([])
  })

  it('페이지 묶음은 존재하는 템플릿만 가리킨다', () => {
    const ids = new Set(templates.map((t) => t.id))
    for (const b of PAGE_BUNDLES) for (const id of b.templateIds) expect(ids.has(id)).toBe(true)
    expect(sectionsFromBundle('monthly-giving', TODAY).map((s) => s.sortOrder)).toEqual([0, 1, 2, 3])
  })

  it('연말 템플릿은 그해 12/31까지만 보인다', () => {
    const yearEnd = templates.find((t) => t.id === 'yearend-cta')!
    const s = sectionFromTemplate(yearEnd, 0)
    expect(shownOn(s, '2026-12-31')).toBe(true)
    expect(shownOn(s, '2027-01-01')).toBe(false)
  })
})

describe('보이는 기간', () => {
  it('상태 판정(시작·끝 당일 포함)', () => {
    const s = { from: '2026-10-01', until: '2026-10-31' }
    expect(scheduleState(s, '2026-09-30')).toBe('upcoming')
    expect(scheduleState(s, '2026-10-01')).toBe('active')
    expect(scheduleState(s, '2026-10-31')).toBe('active')
    expect(scheduleState(s, '2026-11-01')).toBe('ended')
    expect(scheduleState({}, '2026-10-16')).toBe('always')
  })
  it('끝이 시작보다 빠르면 끝을 버린다, 형식 틀린 날짜는 무시', () => {
    expect(parseSchedule({ from: '2026-10-10', until: '2026-10-01' })).toEqual({ from: '2026-10-10' })
    expect(parseSchedule({ from: '2026-13-01', until: 'tomorrow' })).toEqual({})
  })
  it('배지 문구', () => {
    expect(scheduleLabel({ until: '2026-12-31' }, TODAY)).toBe('12/31까지')
    expect(scheduleLabel({ from: '2026-11-01' }, TODAY)).toBe('예약 · 11/1부터')
  })
})

describe('normalizeDisplayFields — 허용값만 저장', () => {
  it('[보안] 임의 CSS·알 수 없는 값은 버리고 기본값이면 키를 지운다', () => {
    expect(normalizeDisplayFields({ headline: 'x', style: { theme: 'red;}</style>', spacing: 'lg', extra: 1 } }))
      .toEqual({ headline: 'x', style: { theme: 'default', spacing: 'lg' } })
    expect(normalizeDisplayFields({ style: { theme: 'default', spacing: 'none' }, schedule: {} })).toEqual({})
  })
})
