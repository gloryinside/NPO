import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/common/filter-bar'

describe('FilterBar', () => {
  it('hasActiveFilters=false일 때 초기화 버튼 숨김', () => {
    const { container } = render(
      <FilterBar hasActiveFilters={false} onReset={() => {}} />
    )
    expect(container.querySelector('[data-slot="filter-reset"]')).toBeNull()
  })

  it('hasActiveFilters=true + 초기화 클릭 시 onReset 호출', () => {
    const onReset = vi.fn()
    render(<FilterBar hasActiveFilters={true} onReset={onReset} />)
    fireEvent.click(screen.getByText('초기화'))
    expect(onReset).toHaveBeenCalledOnce()
  })
})
