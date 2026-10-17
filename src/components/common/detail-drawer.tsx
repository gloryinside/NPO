'use client'

import type { ReactNode } from 'react'
import { Sheet } from '@/components/ui/layer'

export interface DetailDrawerProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
}

/**
 * 목록에서 행을 눌렀을 때 오른쪽에 열리는 상세 패널.
 * 공용 Sheet 위로 옮겼다 — 예전엔 Esc·스크롤 잠금만 있고 포커스가 패널 밖으로 빠져나갔다.
 */
export function DetailDrawer({ open, onClose, title, subtitle, children, footer, width = 520 }: DetailDrawerProps): ReactNode {
  return (
    <Sheet open={open} onClose={onClose} title={title} description={subtitle} footer={footer} maxWidthPx={width}>
      {children}
    </Sheet>
  )
}
