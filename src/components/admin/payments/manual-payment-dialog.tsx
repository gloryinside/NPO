'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type PayMethod = 'cash' | 'transfer' | 'manual'

const METHOD_LABEL: Record<PayMethod, string> = {
  cash: '현금',
  transfer: '계좌이체',
  manual: '기타(수기)',
}

const ERROR_LABEL: Record<string, string> = {
  INVALID_AMOUNT: '금액은 1원 이상 1억원 이하여야 합니다.',
  INVALID_DATE: '납부일 형식이 올바르지 않습니다.',
  INVALID_METHOD: '결제수단 값이 올바르지 않습니다.',
  MEMBER_NOT_FOUND: '후원자를 찾을 수 없습니다.',
  INSERT_FAILED: '납부 기록에 실패했습니다.',
  INVALID_JSON: '입력 형식이 올바르지 않습니다.',
}

interface Props {
  memberId: string
  memberName: string
  trigger: React.ReactNode
}

export function ManualPaymentDialog({ memberId, memberName, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [payDate, setPayDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [payMethod, setPayMethod] = useState<PayMethod>('cash')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function reset() {
    setAmount('')
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayMethod('cash')
    setNote('')
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const numeric = Number(amount.replace(/,/g, ''))
    if (!Number.isFinite(numeric) || numeric <= 0) {
      setError(ERROR_LABEL.INVALID_AMOUNT)
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch(
          `/api/admin/members/${memberId}/manual-payment`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              amount: numeric,
              payDate,
              payMethod,
              note: note || undefined,
            }),
          }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          const code = data?.error as string | undefined
          setError(ERROR_LABEL[code ?? ''] ?? data?.error ?? '등록 실패')
          return
        }
        reset()
        setOpen(false)
        router.refresh()
      } catch {
        setError('네트워크 오류로 기록하지 못했습니다.')
      }
    })
  }

  const inputCls =
    'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <span onClick={() => setOpen(true)}>{trigger}</span>
      <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">
            수기 납부 기록 — {memberName}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="manual-amount"
              className="text-sm font-medium text-[var(--text)]"
            >
              금액 (원)
              <span className="text-[var(--negative)]"> *</span>
            </label>
            <Input
              id="manual-amount"
              type="text"
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="50000"
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="manual-date"
                className="text-sm font-medium text-[var(--text)]"
              >
                납부일
                <span className="text-[var(--negative)]"> *</span>
              </label>
              <Input
                id="manual-date"
                type="date"
                required
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="manual-method"
                className="text-sm font-medium text-[var(--text)]"
              >
                결제수단
              </label>
              <select
                id="manual-method"
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as PayMethod)}
                className={`rounded-lg border px-3 py-2 text-sm outline-none ${inputCls}`}
              >
                {(['cash', 'transfer', 'manual'] as PayMethod[]).map((m) => (
                  <option key={m} value={m}>
                    {METHOD_LABEL[m]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="manual-note"
              className="text-sm font-medium text-[var(--text)]"
            >
              메모 (선택)
            </label>
            <textarea
              id="manual-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="현장 모금 수거, 영수증 번호 등"
              className={`rounded-lg border px-3 py-2 text-sm outline-none resize-none ${inputCls}`}
              maxLength={500}
            />
          </div>
          {error && (
            <p className="text-sm rounded-lg border px-3 py-2 text-[var(--negative)] bg-[rgba(239,68,68,0.1)] border-[rgba(239,68,68,0.4)]">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="bg-[var(--accent)] text-white disabled:opacity-60"
            >
              {isPending ? '기록 중…' : '납부 기록'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
