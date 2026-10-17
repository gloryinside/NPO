"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * 레이어(팝업) 공용 틀 — 직접 만든 `fixed inset-0` 오버레이 대신 이것을 쓴다.
 * base-ui Dialog 위라서 포커스 가두기, Esc 닫기, 배경 스크롤 잠금, 닫은 뒤 원래 버튼으로 포커스 복귀가 기본이다.
 *
 *  - Modal: 화면 가운데. 확인·짧은 입력·미리보기
 *  - Sheet: 오른쪽에서 열리는 패널(모바일은 전체 화면). 상세 보기·긴 편집
 *
 * 머리(제목·설명)와 바닥(버튼)은 고정, 본문만 스크롤된다 — 긴 내용에서도 "저장" 버튼이 사라지지 않게.
 */

type LayerProps = {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  /** 제목 아래 한 줄 설명 — 이 창에서 무엇을 하는지 */
  description?: React.ReactNode
  children: React.ReactNode
  /** 바닥 버튼 영역 */
  footer?: React.ReactNode
  className?: string
  /** 닫기(X) 버튼 숨김 — 반드시 선택하게 해야 할 때만 */
  hideClose?: boolean
}

const MODAL_SIZE = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const

function Shell({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/40 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none" />
        {children}
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Head({ title, description, onClose, hideClose }: Pick<LayerProps, "title" | "description" | "onClose" | "hideClose">) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
      <div className="min-w-0">
        <DialogPrimitive.Title className="text-base font-semibold text-[var(--text)] text-balance">{title}</DialogPrimitive.Title>
        {description && (
          <DialogPrimitive.Description className="mt-1 text-sm text-[var(--muted-foreground)]">{description}</DialogPrimitive.Description>
        )}
      </div>
      {!hideClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="-mr-1 shrink-0 rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text)]"
        >
          <XIcon className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

function Foot({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] bg-[var(--surface-2)]/60 px-5 py-3 sm:flex-row sm:justify-end">
      {children}
    </div>
  )
}

export function Modal({ size = "md", ...p }: LayerProps & { size?: keyof typeof MODAL_SIZE }) {
  return (
    <Shell open={p.open} onClose={p.onClose}>
      <DialogPrimitive.Popup
        className={cn(
          "fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-hero)] outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 motion-reduce:animate-none",
          MODAL_SIZE[size],
          p.className,
        )}
      >
        <Head title={p.title} description={p.description} onClose={p.onClose} hideClose={p.hideClose} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm">{p.children}</div>
        {p.footer && <Foot>{p.footer}</Foot>}
      </DialogPrimitive.Popup>
    </Shell>
  )
}

export function Sheet({ width = "sm:max-w-xl", maxWidthPx, ...p }: LayerProps & { width?: string; maxWidthPx?: number }) {
  return (
    <Shell open={p.open} onClose={p.onClose}>
      <DialogPrimitive.Popup
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-hero)] outline-none data-open:animate-in data-open:slide-in-from-right data-closed:animate-out data-closed:slide-out-to-right motion-reduce:animate-none",
          maxWidthPx ? undefined : width,
          p.className,
        )}
        style={maxWidthPx ? { maxWidth: maxWidthPx } : undefined}
      >
        <Head title={p.title} description={p.description} onClose={p.onClose} hideClose={p.hideClose} />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 text-sm">{p.children}</div>
        {p.footer && <Foot>{p.footer}</Foot>}
      </DialogPrimitive.Popup>
    </Shell>
  )
}
