import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/common/stat-card'

describe('StatCard', () => {
  it('direction별 올바른 기호 렌더', () => {
    const { rerender } = render(
      <StatCard label="당월 수납" value="12,000원"
        delta={{ value: '+8%', direction: 'up', tone: 'positive' }} />
    )
    expect(screen.getByText(/▲/)).toBeTruthy()

    rerender(
      <StatCard label="미납" value="23건"
        delta={{ value: '+3건', direction: 'down', tone: 'negative' }} />
    )
    expect(screen.getByText(/▼/)).toBeTruthy()

    rerender(
      <StatCard label="CMS 성공률" value="94%"
        delta={{ value: '0%', direction: 'flat', tone: 'neutral' }} />
    )
    expect(screen.getByText(/―/)).toBeTruthy()
  })

  it('tone=negative일 때 값 색상 클래스 적용', () => {
    const { container } = render(
      <StatCard label="미납" value="23건" tone="negative" />
    )
    const valueEl = container.querySelector('[data-slot="stat-value"]')
    expect(valueEl?.className).toContain('var(--negative)')
  })

  it('delta 미지정 시 배지 렌더 안 함', () => {
    const { container } = render(
      <StatCard label="당월 수납" value="12,000원" />
    )
    expect(container.querySelector('[data-slot="stat-delta"]')).toBeNull()
  })
})
