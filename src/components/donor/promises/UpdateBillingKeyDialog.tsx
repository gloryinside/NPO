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

interface Props {
  promiseId: string | null
  onClose: () => void
  onSuccess: () => void
}

/**
 * Tier A #10: 후원자 결제수단 변경 다이얼로그.
 * 카드 정보를 입력받아 POST /api/donor/promises/[id]/billing-key 호출.
 */
export function UpdateBillingKeyDialog({ promiseId, onClose, onSuccess }: Props) {
  const [cardNumber, setCardNumber] = useState('')
  const [expYear, setExpYear] = useState('')
  const [expMonth, setExpMonth] = useState('')
  const [cardPassword, setCardPassword] = useState('')
  const [identityNumber, setIdentityNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setCardNumber('')
    setExpYear('')
    setExpMonth('')
    setCardPassword('')
    setIdentityNumber('')
    setError(null)
  }

  function handleClose() {
    reset()
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!promiseId) return
    setError(null)

    if (cardNumber.replace(/\D/g, '').length < 14) {
      setError('카드번호를 정확히 입력해주세요.')
      return
    }
    if (cardPassword.length < 2) {
      setError('카드 비밀번호 앞 2자리를 입력해주세요.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/donor/promises/${promiseId}/billing-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardNumber: cardNumber.replace(/\D/g, ''),
          cardExpirationYear: expYear.padStart(2, '0'),
          cardExpirationMonth: expMonth.padStart(2, '0'),
          cardPassword,
          customerIdentityNumber: identityNumber.replace(/\D/g, ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? '결제수단 변경 실패')
      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'bg-[var(--surface-2)] border-[var(--border)] text-[var(--text)]'

  return (
    <Dialog open={!!promiseId} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-md bg-[var(--surface)] border-[var(--border)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--text)]">결제수단 변경</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3 mt-2">
          <p className="text-xs text-[var(--muted-foreground)]">
            새로 등록한 카드로 다음 달부터 자동 결제됩니다. 카드 정보는 저장되지 않고 PG사로 직접 전송됩니다.
          </p>

          <div>
            <label className="text-sm text-[var(--text)]">카드번호</label>
            <Input
              inputMode="numeric"
              autoComplete="off"
              value={cardNumber}
              onChange={(e) => setCardNumber(e.target.value)}
              placeholder="0000 0000 0000 0000"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-[var(--text)]">유효기간 (MM / YY)</label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  value={expMonth}
                  onChange={(e) => setExpMonth(e.target.value)}
                  placeholder="MM"
                  className={inputCls}
                />
                <Input
                  inputMode="numeric"
                  maxLength={2}
                  value={expYear}
                  onChange={(e) => setExpYear(e.target.value)}
                  placeholder="YY"
                  className={inputCls}
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-[var(--text)]">비밀번호 (앞 2자리)</label>
              <Input
                type="password"
                inputMode="numeric"
                maxLength={2}
                value={cardPassword}
                onChange={(e) => setCardPassword(e.target.value)}
                placeholder="**"
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-[var(--text)]">생년월일 6자리 또는 사업자번호 10자리</label>
            <Input
              inputMode="numeric"
              value={identityNumber}
              onChange={(e) => setIdentityNumber(e.target.value)}
              placeholder="YYMMDD"
              className={inputCls}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-[var(--negative)] bg-[var(--negative-soft)] px-3 py-2 text-sm text-[var(--negative)]">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
            >
              취소
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-[var(--accent)] text-white disabled:opacity-60"
            >
              {loading ? '처리 중...' : '변경'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
