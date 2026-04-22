import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageHeader } from '@/components/common/page-header'

describe('PageHeader', () => {
  it('기본: 제목만 렌더, stats/tabs 영역 숨김', () => {
    const { container } = render(<PageHeader title="대시보드" />)
    expect(screen.getByText('대시보드')).toBeTruthy()
    expect(container.querySelector('[data-slot="page-stats"]')).toBeNull()
    expect(container.querySelector('[data-slot="page-tabs"]')).toBeNull()
  })

  it('tabs 지정 시 탭 렌더 + activeTab 스타일', () => {
    const tabs = [
      { key: 'all', label: '전체', count: 100, href: '/x' },
      { key: 'paid', label: '완료', count: 80, href: '/x?s=paid' },
    ]
    render(<PageHeader title="납입 관리" tabs={tabs} activeTab="paid" />)
    expect(screen.getByText('전체')).toBeTruthy()
    expect(screen.getByText('100')).toBeTruthy()
    const active = screen.getByText('완료').closest('a')
    expect(active?.getAttribute('data-active')).toBe('true')
  })
})
