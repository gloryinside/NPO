/**
 * G-95: 주요 랜딩 variant의 a11y 스모크 테스트.
 * 모든 variant를 테스트하는 건 비용이 크니 각 시각적 weight의 대표 variant만 선택.
 * axe-core가 발견하는 WCAG 위반(라벨, ARIA, 색 대비 등)이 0인지만 검증.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe } from 'jest-axe'

import { HeroMinimal } from '@/components/landing-builder/sections/hero/HeroMinimal'
import { CtaBanner } from '@/components/landing-builder/sections/cta/CtaBanner'
import { StatsGrid } from '@/components/landing-builder/sections/stats/StatsGrid'
import { TestimonialsCards } from '@/components/landing-builder/sections/testimonials/TestimonialsCards'
import { FaqAccordion } from '@/components/landing-builder/sections/faq/FaqAccordion'
import { FinancialsSummary } from '@/components/landing-builder/sections/financials/FinancialsSummary'

import * as HeroSchemas from '@/lib/landing-variants/hero-defaults'
import * as CtaSchemas from '@/lib/landing-variants/cta-defaults'
import * as StatsSchemas from '@/lib/landing-variants/stats-defaults'
import * as TestimonialsSchemas from '@/lib/landing-variants/testimonials-schemas'
import * as FaqSchemas from '@/lib/landing-variants/faq-schemas'
import * as FinancialsSchemas from '@/lib/landing-variants/financials-schemas'

describe('Landing variants — a11y 스모크', () => {
  it('HeroMinimal (minimal): WCAG 위반 0', async () => {
    const { container } = render(<HeroMinimal data={HeroSchemas.heroMinimalDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })

  it('CtaBanner (minimal): WCAG 위반 0', async () => {
    const { container } = render(<CtaBanner data={CtaSchemas.ctaBannerDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })

  it('StatsGrid: WCAG 위반 0', async () => {
    const { container } = render(<StatsGrid data={StatsSchemas.statsGridDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })

  it('TestimonialsCards: WCAG 위반 0', async () => {
    const { container } = render(<TestimonialsCards data={TestimonialsSchemas.testimonialsCardsDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })

  it('FaqAccordion: WCAG 위반 0', async () => {
    const { container } = render(<FaqAccordion data={FaqSchemas.faqAccordionDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })

  it('FinancialsSummary: WCAG 위반 0', async () => {
    const { container } = render(<FinancialsSummary data={FinancialsSchemas.financialsSummaryDefault()} />)
    const result = await axe(container)
    expect(result).toHaveNoViolations()
  })
})
