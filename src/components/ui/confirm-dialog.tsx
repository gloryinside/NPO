"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

/**
 * 브라우저 confirm() 대체 — `if (!(await confirm({...}))) return` 처럼 쓴다.
 * 네이티브 대화상자는 디자인·다크 모드를 따르지 않고, 모바일 인앱 브라우저에서 막히기도 한다.
 */
export type ConfirmOptions = {
  title: string
  description?: React.ReactNode
  confirmText?: string
  cancelText?: string
  /** danger: 삭제·해지처럼 되돌리기 어려운 동작 */
  tone?: "default" | "danger"
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void }

const ConfirmContext = React.createContext<((o: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<Pending | null>(null)

  const confirm = React.useCallback(
    (o: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setPending((prev) => {
          prev?.resolve(false) // 이전 확인창이 열려 있었다면 취소로 닫는다
          return { ...o, resolve }
        })
      }),
    [],
  )

  const close = (ok: boolean) => {
    pending?.resolve(ok)
    setPending(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!pending} onOpenChange={(open) => { if (!open) close(false) }}>
        {pending && (
          <DialogContent showCloseButton={false} className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{pending.title}</DialogTitle>
              {pending.description && <DialogDescription>{pending.description}</DialogDescription>}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)} autoFocus>
                {pending.cancelText ?? "취소"}
              </Button>
              <Button variant={pending.tone === "danger" ? "destructive" : "default"} onClick={() => close(true)}>
                {pending.confirmText ?? "확인"}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm은 ConfirmProvider 안에서만 쓸 수 있습니다(루트 레이아웃에 있음).")
  return ctx
}
