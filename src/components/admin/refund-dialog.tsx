'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ReasonCode } from '@/lib/payments/refund'

interface RefundDialogProps {
  payment: {
    id: string
    amount: number
    pay_date: string | null
    toss_payment_key: string | null
    members?: { name: string } | null
  } | null
  onClose: () => void
  onRefunded: () => void
}

const REASON_OPTIONS: { value: ReasonCode; label: string }[] = [
  { value: 'donor_request', label: '후원자 요청' },
  { value: 'duplicate', label: '중복 결제' },
  { value: 'error', label: '오류' },
  { value: 'other', label: '기타' },
]

function formatKRW(n: number) {
  return `${new Intl.NumberFormat('ko-KR').format(n)}원`
}

function formatDate(v: string | null) {
  if (!v) return '-'
  try { return new Date(v).toLocaleDateString('ko-KR') } catch { return v }
}

export function RefundDialog({ payment, onClose, onRefunded }: RefundDialogProps) {
  const [isFullRefund, setIsFullRefund] = useState(true)
  const [refundAmount, setRefundAmount] = useState('')
  const [reasonCode, setReasonCode] = useState<ReasonCode | ''>('')
  const [reasonNote, setReasonNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    setIsFullRefund(true)
    setRefundAmount('')
    setReasonCode('')
    setReasonNote('')
    setError(null)
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!payment) return
    setError(null)

    if (!reasonCode) {
      setError('환불 사유를 선택해주세요.')
      return
    }

    const amount = isFullRefund ? undefined : Number(refundAmount)
    if (!isFullRefund) {
      if (!amount || amount <= 0 || amount > payment.amount) {
        setError('유효한 금액을 입력해주세요.')
        return
      }
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCode,
          reasonNote: reasonNote.trim() || undefined,
          refundAmount: amount,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '환불 처리 실패')
      onRefunded()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'

  return (
    <Dialog open={!!payment} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">환불 처리</DialogTitle>
        </DialogHeader>

        {payment && (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
            {/* 결제 요약 */}
            <div className="rounded-lg border px-4 py-3 bg-[var(--surface-2)] border-[var(--border)] text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">후원자</span>
                <span className="text-[var(--text)] font-medium">{payment.members?.name ?? '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">결제일</span>
                <span className="text-[var(--text)]">{formatDate(payment.pay_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--muted-foreground)]">결제금액</span>
                <span className="text-[var(--text)] font-semibold">{formatKRW(payment.amount)}</span>
              </div>
            </div>

            {/* 환불 금액 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-[var(--text)]">
                환불금액 <span className="text-[var(--negative)]">*</span>
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={payment.amount}
                  value={isFullRefund ? String(payment.amount) : refundAmount}
                  disabled={isFullRefund}
                  onChange={(e) => {
                    setRefundAmount(e.target.value)
                    setIsFullRefund(false)
                  }}
                  className={`flex-1 ${inputCls}`}
                />
                <span className="text-sm text-[var(--muted-foreground)]">원</span>
              </div>
              <label className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isFullRefund}
                  onChange={(e) => {
                    setIsFullRefund(e.target.checked)
                    if (e.target.checked) setRefundAmount('')
                  }}
                  className="rounded"
                />
                전액 환불
              </label>
            </div>

            {/* 환불 사유 */}
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-[var(--text)]">
                환불사유 <span className="text-[var(--negative)]">*</span>
              </span>
              <div className="flex flex-col gap-1.5">
                {REASON_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 text-sm text-[var(--text)] cursor-pointer">
                    <input
                      type="radio"
                      name="reasonCode"
                      value={opt.value}
                      checked={reasonCode === opt.value}
                      onChange={() => setReasonCode(opt.value)}
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </div>

            {/* 메모 */}
            <div className="flex flex-col gap-1">
              <label htmlFor="refund-note" className="text-sm font-medium text-[var(--text)]">
                메모 (선택)
              </label>
              <Input
                id="refund-note"
                value={reasonNote}
                onChange={(e) => setReasonNote(e.target.value)}
                placeholder="추가 사유를 입력하세요"
                className={inputCls}
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
                onClick={handleClose}
                className="border-[var(--border)] text-[var(--text)] bg-[var(--surface-2)]"
              >
                취소
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-[var(--negative)] text-white disabled:opacity-60"
              >
                {loading ? '처리 중...' : '환불 처리 →'}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
