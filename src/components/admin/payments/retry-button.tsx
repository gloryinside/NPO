'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  paymentId: string
}

const ERROR_LABEL: Record<string, string> = {
  NOT_FOUND: '결제 정보를 찾을 수 없습니다.',
  INVALID_STATUS: '재시도 가능한 상태가 아닙니다.',
  BILLING_KEY_MISSING:
    '자동결제 키가 없어 재시도할 수 없습니다. 카드 재등록이 필요합니다.',
  RATE_LIMITED:
    '최근 재시도 한도를 초과했습니다. 잠시 후 다시 시도해주세요.',
  TOSS_UNAVAILABLE:
    '결제사 연결에 실패했습니다. 잠시 후 다시 시도해주세요.',
}

export function RetryButton({ paymentId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'success'; message: string }
    | { kind: 'failed'; message: string }
    | { kind: 'error'; message: string }
  >({ kind: 'idle' })

  function onClick(e: React.MouseEvent) {
    e.stopPropagation() // 행 클릭 이벤트 버블링 차단
    setStatus({ kind: 'idle' })

    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/payments/${paymentId}/retry`, {
          method: 'POST',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const code = data?.error as string | undefined
          setStatus({
            kind: 'error',
            message: ERROR_LABEL[code ?? ''] ?? '재시도 실패',
          })
          return
        }
        // success:true 면 결제 성공, false면 Toss 비즈니스 실패
        if (data.success) {
          setStatus({
            kind: 'success',
            message: '재청구 성공',
          })
          router.refresh()
        } else {
          setStatus({
            kind: 'failed',
            message: data.message ?? '재청구 실패',
          })
          router.refresh()
        }
      } catch {
        setStatus({ kind: 'error', message: '네트워크 오류' })
      }
    })
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          borderColor: 'var(--accent)',
          color: 'var(--accent)',
          background: 'var(--surface)',
        }}
      >
        {isPending ? '재시도 중…' : '재시도'}
      </button>
      {status.kind !== 'idle' && (
        <span
          className="text-xs"
          style={{
            color:
              status.kind === 'success'
                ? 'var(--positive)'
                : status.kind === 'failed'
                  ? 'var(--warning)'
                  : 'var(--negative)',
          }}
        >
          {status.message}
        </span>
      )}
    </div>
  )
}
