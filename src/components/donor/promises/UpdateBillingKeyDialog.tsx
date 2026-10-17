'use client'

import { useState } from 'react'
import { loadTossPayments } from '@tosspayments/payment-sdk'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface Props {
  promiseId: string | null
  onClose: () => void
  /** 결제창 방식은 완료 페이지로 이동하므로 호출되지 않는다(호환용) */
  onSuccess: () => void
}

/**
 * 후원자 결제수단 변경 — 토스 결제창(requestBillingAuth) 표준 방식.
 * 카드번호·비밀번호를 이 화면에서 받지 않는다. 결제창에서 카드 입력·본인인증을 마치면
 * /donor/promises/billing/success 로 돌아와 서버가 새 빌링키로 교체하고 예전 키를 삭제한다.
 */
export function UpdateBillingKeyDialog({ promiseId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setError(null)
    onClose()
  }

  async function openCheckout() {
    if (!promiseId) return
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/donor/promises/${promiseId}/billing-auth`, { method: 'POST' })
      const data = (await res.json()) as { customerKey?: string; clientKey?: string; error?: string }
      if (!res.ok || !data.customerKey || !data.clientKey) throw new Error(data.error ?? '결제수단 변경을 시작하지 못했습니다.')

      const tossPayments = await loadTossPayments(data.clientKey)
      const back = new URL('/donor/promises/billing/success', window.location.origin)
      back.searchParams.set('promiseId', promiseId)
      await tossPayments.requestBillingAuth('카드', {
        customerKey: data.customerKey,
        successUrl: back.toString(),
        failUrl: `${window.location.origin}/donor/promises?card=failed`,
      })
    } catch (err) {
      // 결제창을 닫아도 여기로 — 기존 카드는 그대로 유지된다
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setLoading(false)
    }
  }

  return (
    <Dialog open={!!promiseId} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md border-[var(--border)] bg-[var(--surface)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">결제수단 변경</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
          <p>
            <b className="text-[var(--text)]">토스페이먼츠 결제창</b>에서 새 카드를 등록합니다.
            카드 정보와 본인인증은 결제창에서 입력하며, 기관 서버에는 카드번호가 저장되지 않습니다.
          </p>
          <p>새 카드 등록이 끝나면 기존 카드의 자동결제 등록은 삭제됩니다.</p>
          {error && (
            <p role="alert" className="rounded-xl border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-[var(--negative)]">
              {error}
            </p>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleClose} disabled={loading}>취소</Button>
          <Button onClick={openCheckout} disabled={loading}>
            {loading ? '결제창 여는 중…' : '결제창에서 카드 등록'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
