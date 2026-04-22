import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { DetailDrawer } from '@/components/common/detail-drawer'

describe('DetailDrawer', () => {
  it('open=false일 때 렌더 안 함', () => {
    const { container } = render(
      <DetailDrawer open={false} onClose={() => {}} title="상세">
        <p>내용</p>
      </DetailDrawer>
    )
    expect(container.querySelector('[data-slot="drawer-panel"]')).toBeNull()
  })

  it('ESC 키 누르면 onClose 호출', () => {
    const onClose = vi.fn()
    render(
      <DetailDrawer open={true} onClose={onClose} title="상세">
        <p>내용</p>
      </DetailDrawer>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })
})
