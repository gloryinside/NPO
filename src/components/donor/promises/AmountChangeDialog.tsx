'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface AmountHistoryItem {
  id: string
  previousAmount: number
  newAmount: number
  direction: 'up' | 'down' | 'same'
  actor: 'member' | 'admin' | 'system'
  reason: string | null
  createdAt: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  promiseId: string
  currentAmount: number
  onSubmit: (newAmount: number, reason: string | null) => Promise<void>
  submitting: boolean
}

/**
 * Phase 5-C: 정기후원 금액 변경 다이얼로그.
 *   - 빠른 선택 칩 (현재 대비 +1만/+3만/-1만/2배)
 *   - 연 환산 영향 프리뷰
 *   - 이력 탭 — 서버에서 fetch하여 시계열로 표시
 */
export function AmountChangeDialog({
  open,
  onOpenChange,
  promiseId,
  currentAmount,
  onSubmit,
  submitting,
}: Props) {
  const [tab, setTab] = useState<'edit' | 'history'>('edit')
  const [amountInput, setAmountInput] = useState('')
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [history, setHistory] = useState<AmountHistoryItem[] | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (open) {
      setTab('edit')
      setAmountInput(currentAmount > 0 ? String(currentAmount) : '')
      setReason('')
      setLocalError(null)
      setHistory(null)
    }
  }, [open, currentAmount])

  useEffect(() => {
    if (open && tab === 'history' && history === null) {
      setHistoryLoading(true)
      fetch(`/api/donor/promises/${promiseId}/amount-history`)
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((data) => setHistory(data.history ?? []))
        .catch(() => setHistory([]))
        .finally(() => setHistoryLoading(false))
    }
  }, [open, tab, history, promiseId])

  const nextAmount = Number(amountInput)
  const valid = Number.isFinite(nextAmount) && nextAmount > 0
  const direction: 'up' | 'down' | 'same' = !valid
    ? 'same'
    : nextAmount > currentAmount
      ? 'up'
      : nextAmount < currentAmount
        ? 'down'
        : 'same'
  const delta = valid ? nextAmount - currentAmount : 0
  const yearlyImpact = valid ? nextAmount * 12 : 0

  async function handleSubmit() {
    setLocalError(null)
    if (!valid) {
      setLocalError('유효한 금액을 입력하세요.')
      return
    }
    if (direction === 'same') {
      setLocalError('현재 금액과 동일합니다.')
      return
    }
    try {
      await onSubmit(nextAmount, reason.trim() || null)
    } catch {
      setLocalError('처리 중 오류가 발생했습니다.')
    }
  }

  function quick(value: number) {
    const base = Number(amountInput) || currentAmount
    const next = Math.max(0, base + value)
    setAmountInput(String(next))
  }

  const inputStyle = {
    background: 'var(--surface-2)',
    borderColor: 'var(--border)',
    color: 'var(--text)',
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <DialogHeader>
          <DialogTitle style={{ color: 'var(--text)' }}>
            후원 금액 변경
          </DialogTitle>
        </DialogHeader>

        {/* 탭 */}
        <div className="mt-1 flex gap-1 border-b border-[var(--border)]">
          <TabButton active={tab === 'edit'} onClick={() => setTab('edit')}>
            금액 변경
          </TabButton>
          <TabButton
            active={tab === 'history'}
            onClick={() => setTab('history')}
          >
            변경 이력
          </TabButton>
        </div>

        {tab === 'edit' && (
          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="new-amount" style={{ color: 'var(--text)' }}>
                새 후원 금액 (원)
              </Label>
              <Input
                id="new-amount"
                type="number"
                min={1}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="50000"
                style={inputStyle}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip onClick={() => quick(+10_000)}>+1만</Chip>
                <Chip onClick={() => quick(+30_000)}>+3만</Chip>
                <Chip onClick={() => quick(+50_000)}>+5만</Chip>
                <Chip onClick={() => quick(-10_000)}>-1만</Chip>
                <Chip
                  onClick={() =>
                    setAmountInput(String(Math.max(0, currentAmount * 2)))
                  }
                >
                  2배
                </Chip>
                <Chip
                  onClick={() =>
                    setAmountInput(
                      String(Math.max(0, Math.floor(currentAmount / 2)))
                    )
                  }
                >
                  절반
                </Chip>
              </div>
            </div>

            {/* 영향 프리뷰 */}
            {valid && currentAmount > 0 && (
              <div
                className="rounded-md border p-3 text-sm"
                style={{
                  background:
                    direction === 'up'
                      ? 'rgba(34,197,94,0.08)'
                      : direction === 'down'
                        ? 'rgba(239,68,68,0.08)'
                        : 'var(--surface-2)',
                  borderColor: 'var(--border)',
                  color: 'var(--text)',
                }}
                data-testid="amount-preview"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">
                    {direction === 'up'
                      ? '업그레이드'
                      : direction === 'down'
                        ? '다운그레이드'
                        : '변경 없음'}
                  </span>
                  <span className="font-semibold">
                    {formatDelta(delta)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  다음 결제일부터 <b>{formatKRW(nextAmount)}</b>으로
                  청구됩니다. 연간 환산 {formatKRW(yearlyImpact)}.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-1">
              <Label htmlFor="reason" style={{ color: 'var(--text)' }}>
                변경 사유 (선택, 500자 이내)
              </Label>
              <Input
                id="reason"
                type="text"
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="더 많이 돕고 싶어서 등"
                style={inputStyle}
              />
            </div>

            {localError && (
              <p className="text-sm" style={{ color: 'var(--negative)' }}>
                {localError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => onOpenChange(false)}
                style={{ color: 'var(--muted-foreground)' }}
              >
                취소
              </Button>
              <Button
                disabled={submitting || !valid || direction === 'same'}
                onClick={handleSubmit}
                style={{ background: 'var(--accent)', color: '#fff' }}
              >
                {submitting
                  ? '변경 중...'
                  : direction === 'up'
                    ? '업그레이드'
                    : direction === 'down'
                      ? '다운그레이드'
                      : '변경'}
              </Button>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <div className="mt-4">
            {historyLoading ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                불러오는 중...
              </p>
            ) : !history || history.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--muted-foreground)]">
                아직 금액 변경 이력이 없습니다.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {history.map((h) => (
                  <li key={h.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{
                          background:
                            h.direction === 'up'
                              ? 'rgba(34,197,94,0.15)'
                              : h.direction === 'down'
                                ? 'rgba(239,68,68,0.15)'
                                : 'var(--surface-2)',
                          color:
                            h.direction === 'up'
                              ? 'var(--positive)'
                              : h.direction === 'down'
                                ? 'var(--negative)'
                                : 'var(--muted-foreground)',
                        }}
                      >
                        {h.direction === 'up'
                          ? '업'
                          : h.direction === 'down'
                            ? '다운'
                            : '동일'}
                      </span>
                      <span className="flex-1 text-sm text-[var(--text)]">
                        {formatKRW(h.previousAmount)} →{' '}
                        <b>{formatKRW(h.newAmount)}</b>
                      </span>
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {formatRelativeDate(h.createdAt)}
                      </span>
                    </div>
                    {h.reason && (
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {h.reason}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2 text-sm transition-colors"
      style={{
        color: active ? 'var(--accent)' : 'var(--muted-foreground)',
        borderBottom: active
          ? '2px solid var(--accent)'
          : '2px solid transparent',
        fontWeight: active ? 500 : 400,
      }}
    >
      {children}
    </button>
  )
}

function Chip({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-2.5 py-1 text-xs text-[var(--muted-foreground)] transition-opacity hover:opacity-80"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface-2)',
      }}
    >
      {children}
    </button>
  )
}

function formatKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function formatDelta(delta: number): string {
  if (delta === 0) return '±0원'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}${Math.abs(delta).toLocaleString('ko-KR')}원`
}

function formatRelativeDate(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}
