# Phase 7-D-2-b: 관리자 환불 처리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 Toss 온라인 결제 건에 대해 전액/부분 환불을 처리할 수 있는 API + UI 구현

**Architecture:** DB 마이그레이션으로 cancelled_at/refund_amount/cancel_reason 컬럼 추가 → lib/payments/refund.ts에 핵심 환불 로직 분리 → POST /api/admin/payments/[id]/refund 라우트에서 호출 → PaymentList에 환불 버튼 + RefundDialog 모달 추가. retry-charge.ts 패턴을 그대로 따른다.

**Tech Stack:** Next.js 16 App Router, TypeScript strict, Supabase (admin client), Toss Payments cancel API, vitest, Shadcn Dialog/Button/Input

---

## File Structure

| 파일 | 작업 |
|------|------|
| `supabase/migrations/20260423000002_payments_refund_columns.sql` | 신규 — cancelled_at, refund_amount, cancel_reason 컬럼 |
| `src/types/payment.ts` | 수정 — Payment 타입에 3개 컬럼 추가 |
| `src/lib/payments/refund.ts` | 신규 — 핵심 환불 로직 (Toss 호출 + DB 업데이트) |
| `src/app/api/admin/payments/[id]/refund/route.ts` | 신규 — POST 라우트 (thin, lib 호출) |
| `src/components/admin/refund-dialog.tsx` | 신규 — 환불 모달 컴포넌트 |
| `src/components/admin/payment-list.tsx` | 수정 — 환불 버튼 + RefundDialog 연결 + 툴팁 |
| `tests/unit/payments/refund.test.ts` | 신규 — 8개 단위 테스트 |

---

## Task 1: DB 마이그레이션

**Files:**
- Create: `supabase/migrations/20260423000002_payments_refund_columns.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- Phase 7-D-2-b: 관리자 환불 처리 컬럼
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount bigint,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
```

파일 경로: `supabase/migrations/20260423000002_payments_refund_columns.sql`

- [ ] **Step 2: Supabase MCP로 마이그레이션 적용**

Supabase MCP `apply_migration` 도구 사용:
- migration_name: `20260423000002_payments_refund_columns`
- query: 위 SQL

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260423000002_payments_refund_columns.sql
git commit -m "feat(db): Phase 7-D-2-b payments 환불 컬럼 (cancelled_at, refund_amount, cancel_reason)"
```

---

## Task 2: Payment 타입 업데이트

**Files:**
- Modify: `src/types/payment.ts`

- [ ] **Step 1: Payment 타입에 컬럼 추가**

`src/types/payment.ts`의 `Payment` 타입에 아래 3개 필드 추가 (기존 `updated_at` 앞에):

```typescript
export type Payment = {
  id: string;
  org_id: string;
  payment_code: string;
  member_id: string | null;
  promise_id: string | null;
  campaign_id: string | null;
  amount: number;
  pay_date: string | null;
  deposit_date: string | null;
  pay_status: PayStatus;
  income_status: IncomeStatus;
  pg_tx_id: string | null;
  pg_method: string | null;
  fail_reason: string | null;
  receipt_id: string | null;
  toss_payment_key: string | null;
  idempotency_key: string | null;
  receipt_url: string | null;
  requested_at: string | null;
  approved_at: string | null;
  cancelled_at: string | null;
  refund_amount: number | null;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/types/payment.ts
git commit -m "feat(types): Payment에 환불 컬럼 타입 추가"
```

---

## Task 3: 환불 핵심 로직 lib

**Files:**
- Create: `src/lib/payments/refund.ts`
- Test: `tests/unit/payments/refund.test.ts`

- [ ] **Step 1: 테스트 파일 작성 (실패 확인용)**

`tests/unit/payments/refund.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'

vi.mock('@/lib/toss/keys', () => ({
  getOrgTossKeys: vi.fn(),
}))

import { refundPayment } from '@/lib/payments/refund'
import { getOrgTossKeys } from '@/lib/toss/keys'

const mockedKeys = getOrgTossKeys as unknown as ReturnType<typeof vi.fn>

const BASE_PAYMENT = {
  id: 'pay-1',
  org_id: 'org-1',
  amount: 100000,
  pay_status: 'paid',
  toss_payment_key: 'toss-key-abc',
}

function makeSupabase(opts: {
  row: unknown
  updateError?: unknown
}): SupabaseClient {
  const updateChain = {
    eq: function(this: typeof updateChain) { return this },
    select: () => Promise.resolve({ error: opts.updateError ?? null }),
  }
  const selectChain = {
    eq: function(this: typeof selectChain) { return this },
    maybeSingle: () => Promise.resolve({ data: opts.row, error: null }),
  }
  return {
    from: vi.fn(() => ({
      select: () => selectChain,
      update: () => updateChain,
    })),
  } as unknown as SupabaseClient
}

beforeEach(() => {
  mockedKeys.mockReset()
  mockedKeys.mockResolvedValue({ tossSecretKey: 'secret-test' })
})

describe('refundPayment 사전 검증', () => {
  it('payment 없음 → NOT_FOUND', async () => {
    const sb = makeSupabase({ row: null })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'x', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('NOT_FOUND')
  })

  it('pay_status !== paid → INVALID_STATUS', async () => {
    const sb = makeSupabase({ row: { ...BASE_PAYMENT, pay_status: 'refunded' } })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_STATUS')
  })

  it('toss_payment_key 없음 → OFFLINE_PAYMENT', async () => {
    const sb = makeSupabase({ row: { ...BASE_PAYMENT, toss_payment_key: null } })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('OFFLINE_PAYMENT')
  })

  it('refundAmount > amount → INVALID_AMOUNT', async () => {
    const sb = makeSupabase({ row: BASE_PAYMENT })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other', refundAmount: 200000 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_AMOUNT')
  })

  it('refundAmount <= 0 → INVALID_AMOUNT', async () => {
    const sb = makeSupabase({ row: BASE_PAYMENT })
    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'other', refundAmount: 0 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('INVALID_AMOUNT')
  })

  it('Toss API 실패 → TOSS_FAILED, DB 변경 없음', async () => {
    const updateSpy = vi.fn()
    const selectChain = {
      eq: function(this: typeof selectChain) { return this },
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: '취소 불가' }),
    }) as unknown as typeof fetch

    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'error' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toBe('TOSS_FAILED')
    expect(updateSpy).not.toHaveBeenCalled()
  })

  it('전액 환불 성공 → refund_amount null, pay_status refunded', async () => {
    const capturedUpdate: unknown[] = []
    const updateChain = {
      eq: function(this: typeof updateChain) { return this },
      select: () => Promise.resolve({ error: null }),
    }
    const updateSpy = vi.fn((data: unknown) => {
      capturedUpdate.push(data)
      return updateChain
    })
    const selectChain = {
      eq: function(this: typeof selectChain) { return this },
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const r = await refundPayment({ supabase: sb, orgId: 'org-1', paymentId: 'pay-1', reasonCode: 'donor_request' })
    expect(r.ok).toBe(true)
    const updated = capturedUpdate[0] as Record<string, unknown>
    expect(updated.pay_status).toBe('refunded')
    expect(updated.refund_amount).toBeNull()
    expect(updated.cancel_reason).toBe('donor_request')
  })

  it('부분 환불 성공 → refund_amount=50000, cancel_reason 포함', async () => {
    const capturedUpdate: unknown[] = []
    const updateChain = {
      eq: function(this: typeof updateChain) { return this },
      select: () => Promise.resolve({ error: null }),
    }
    const updateSpy = vi.fn((data: unknown) => {
      capturedUpdate.push(data)
      return updateChain
    })
    const selectChain = {
      eq: function(this: typeof selectChain) { return this },
      maybeSingle: () => Promise.resolve({ data: BASE_PAYMENT, error: null }),
    }
    const sb = {
      from: vi.fn(() => ({
        select: () => selectChain,
        update: updateSpy,
      })),
    } as unknown as SupabaseClient

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    }) as unknown as typeof fetch

    const r = await refundPayment({
      supabase: sb, orgId: 'org-1', paymentId: 'pay-1',
      reasonCode: 'duplicate', reasonNote: '이중청구', refundAmount: 50000,
    })
    expect(r.ok).toBe(true)
    const updated = capturedUpdate[0] as Record<string, unknown>
    expect(updated.refund_amount).toBe(50000)
    expect(updated.cancel_reason).toBe('duplicate:이중청구')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/unit/payments/refund.test.ts 2>&1 | tail -10
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: lib 구현**

`src/lib/payments/refund.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { getOrgTossKeys } from '@/lib/toss/keys'

export type ReasonCode = 'donor_request' | 'duplicate' | 'error' | 'other'

const REASON_LABELS: Record<ReasonCode, string> = {
  donor_request: '후원자 요청',
  duplicate: '중복 결제',
  error: '오류',
  other: '기타',
}

export interface RefundParams {
  supabase: SupabaseClient
  orgId: string
  paymentId: string
  reasonCode: ReasonCode
  reasonNote?: string
  refundAmount?: number
}

export type RefundResult =
  | { ok: true; refundAmount: number | null }
  | { ok: false; error: 'NOT_FOUND' | 'INVALID_STATUS' | 'OFFLINE_PAYMENT' | 'INVALID_AMOUNT' | 'TOSS_FAILED' | 'DB_FAILED'; message?: string }

export async function refundPayment(params: RefundParams): Promise<RefundResult> {
  const { supabase, orgId, paymentId, reasonCode, reasonNote, refundAmount } = params

  const { data: payment } = await supabase
    .from('payments')
    .select('id, org_id, amount, pay_status, toss_payment_key')
    .eq('id', paymentId)
    .eq('org_id', orgId)
    .maybeSingle()

  if (!payment) return { ok: false, error: 'NOT_FOUND' }
  if (payment.pay_status !== 'paid') return { ok: false, error: 'INVALID_STATUS' }
  if (!payment.toss_payment_key) return { ok: false, error: 'OFFLINE_PAYMENT' }

  if (refundAmount !== undefined) {
    if (refundAmount <= 0 || refundAmount > payment.amount) {
      return { ok: false, error: 'INVALID_AMOUNT' }
    }
  }

  const { tossSecretKey } = await getOrgTossKeys(supabase, orgId)

  const cancelReason = reasonNote
    ? `${REASON_LABELS[reasonCode]} - ${reasonNote}`
    : REASON_LABELS[reasonCode]

  const body: Record<string, unknown> = { cancelReason }
  if (refundAmount !== undefined) body.cancelAmount = refundAmount

  const tossRes = await fetch(
    `https://api.tosspayments.com/v1/payments/${payment.toss_payment_key}/cancel`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(tossSecretKey + ':').toString('base64')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  )

  if (!tossRes.ok) {
    const err = await tossRes.json().catch(() => ({}))
    return { ok: false, error: 'TOSS_FAILED', message: (err as Record<string, unknown>).message as string }
  }

  const cancelReason4db = reasonNote ? `${reasonCode}:${reasonNote}` : reasonCode

  const { error: dbErr } = await supabase
    .from('payments')
    .update({
      pay_status: 'refunded',
      refund_amount: refundAmount ?? null,
      cancelled_at: new Date().toISOString(),
      cancel_reason: cancelReason4db,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .eq('org_id', orgId)
    .select()

  if (dbErr) return { ok: false, error: 'DB_FAILED', message: dbErr.message }

  return { ok: true, refundAmount: refundAmount ?? null }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run tests/unit/payments/refund.test.ts 2>&1 | tail -15
```

Expected: 8 passed

- [ ] **Step 5: 전체 테스트 회귀 확인**

```bash
npx vitest run --project unit 2>&1 | tail -5
```

Expected: all passed (기존 221 + 8 = 229)

- [ ] **Step 6: 커밋**

```bash
git add src/lib/payments/refund.ts tests/unit/payments/refund.test.ts
git commit -m "feat(payments): refundPayment lib + 8 unit tests"
```

---

## Task 4: API 라우트

**Files:**
- Create: `src/app/api/admin/payments/[id]/refund/route.ts`

- [ ] **Step 1: 라우트 구현**

`src/app/api/admin/payments/[id]/refund/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { refundPayment, type ReasonCode } from '@/lib/payments/refund'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

const VALID_REASON_CODES: ReasonCode[] = ['donor_request', 'duplicate', 'error', 'other']

export async function POST(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: paymentId } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reasonCode, reasonNote, refundAmount } = body as {
    reasonCode?: string
    reasonNote?: string
    refundAmount?: number
  }

  if (!reasonCode || !VALID_REASON_CODES.includes(reasonCode as ReasonCode)) {
    return NextResponse.json({ error: '유효한 환불 사유를 선택해주세요.' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const result = await refundPayment({
    supabase,
    orgId: guard.ctx.tenant.id,
    paymentId,
    reasonCode: reasonCode as ReasonCode,
    reasonNote: reasonNote?.trim() || undefined,
    refundAmount: typeof refundAmount === 'number' ? refundAmount : undefined,
  })

  if (!result.ok) {
    const statusMap: Record<string, number> = {
      NOT_FOUND: 404,
      INVALID_STATUS: 400,
      OFFLINE_PAYMENT: 400,
      INVALID_AMOUNT: 400,
      TOSS_FAILED: 502,
      DB_FAILED: 500,
    }
    const msgMap: Record<string, string> = {
      NOT_FOUND: '납입 정보를 찾을 수 없습니다.',
      INVALID_STATUS: '환불 가능한 상태가 아닙니다.',
      OFFLINE_PAYMENT: '온라인 결제만 환불 가능합니다.',
      INVALID_AMOUNT: '유효한 환불 금액을 입력해주세요.',
      TOSS_FAILED: `결제 취소 실패: ${result.message ?? ''}`,
      DB_FAILED: 'DB 업데이트 실패. 관리자에게 문의해주세요.',
    }
    return NextResponse.json(
      { error: msgMap[result.error] ?? result.error },
      { status: statusMap[result.error] ?? 500 }
    )
  }

  logAudit({
    orgId: guard.ctx.tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'payment.refund',
    resourceType: 'payment',
    resourceId: paymentId,
    summary: result.refundAmount
      ? `부분 환불 처리 (${result.refundAmount.toLocaleString('ko-KR')}원)`
      : '전액 환불 처리',
    metadata: {
      refund_amount: result.refundAmount,
      reason_code: reasonCode,
      reason_note: reasonNote ?? null,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/admin/payments/[id]/refund/route.ts
git commit -m "feat(api): POST /api/admin/payments/[id]/refund"
```

---

## Task 5: RefundDialog 컴포넌트

**Files:**
- Create: `src/components/admin/refund-dialog.tsx`

- [ ] **Step 1: 컴포넌트 구현**

`src/components/admin/refund-dialog.tsx`:

```typescript
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
```

- [ ] **Step 2: 타입체크**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/refund-dialog.tsx
git commit -m "feat(ui): RefundDialog 컴포넌트"
```

---

## Task 6: PaymentList 수정

**Files:**
- Modify: `src/components/admin/payment-list.tsx`

PaymentList에서 수정할 부분은 세 곳이다:
1. import 추가 + state 추가
2. `<RefundDialog>` 렌더링
3. 각 행에 환불 버튼 + 환불 상태 툴팁

- [ ] **Step 1: import 및 state 추가**

`src/components/admin/payment-list.tsx` 상단 import 블록에 추가:

```typescript
import { RefundDialog } from '@/components/admin/refund-dialog'
```

`PaymentList` 함수 내 기존 state 선언 아래 추가:

```typescript
const [refundTarget, setRefundTarget] = useState<PaymentWithRelations | null>(null)
```

- [ ] **Step 2: RefundDialog 렌더링 추가**

`PaymentList` return 내 `<AddPaymentDialog .../>` 바로 아래에 추가:

```tsx
<RefundDialog
  payment={refundTarget}
  onClose={() => setRefundTarget(null)}
  onRefunded={() => { setRefundTarget(null); router.refresh() }}
/>
```

- [ ] **Step 3: 납부상태 TableCell 수정 — 환불 버튼 + 툴팁**

기존 납부상태 셀:

```tsx
<TableCell>
  <PayStatusBadge status={p.pay_status} />
</TableCell>
```

아래로 교체:

```tsx
<TableCell>
  <div className="flex items-center gap-2">
    <PayStatusBadge status={p.pay_status} />
    {p.pay_status === 'refunded' && (
      <span
        className="text-xs text-[var(--muted-foreground)]"
        title={[
          p.refund_amount != null
            ? `부분환불 ${new Intl.NumberFormat('ko-KR').format(p.refund_amount)}원`
            : '전액환불',
          p.cancel_reason ? `사유: ${p.cancel_reason.split(':')[0]}` : '',
        ].filter(Boolean).join(' | ')}
      >
        ⓘ
      </span>
    )}
    {p.pay_status === 'paid' && p.toss_payment_key && (
      <button
        type="button"
        onClick={() => setRefundTarget(p)}
        className="text-xs px-2 py-0.5 rounded border border-[var(--negative)] text-[var(--negative)] hover:bg-[var(--negative-soft)] transition-colors"
      >
        환불
      </button>
    )}
  </div>
</TableCell>
```

- [ ] **Step 4: 타입체크 + 빌드**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run build 2>&1 | tail -10
```

Expected: 에러 없음, build 성공

- [ ] **Step 5: 전체 테스트**

```bash
npx vitest run --project unit 2>&1 | tail -5
```

Expected: 229 passed

- [ ] **Step 6: 커밋**

```bash
git add src/components/admin/payment-list.tsx
git commit -m "feat(ui): PaymentList 환불 버튼 + RefundDialog 연결"
```

---

## 수동 QA 체크리스트

PR 머지 전 브라우저에서 확인:

- [ ] paid + toss_payment_key 있는 행에만 "환불" 버튼 노출
- [ ] paid + toss_payment_key 없는 행에 버튼 미노출
- [ ] refunded 상태 행에 버튼 미노출, ⓘ 아이콘 표시
- [ ] ⓘ hover 시 환불금액/사유 툴팁 표시
- [ ] 환불 버튼 클릭 → 모달 오픈, 결제 정보 표시
- [ ] 전액 환불 체크박스 기본 체크, 금액 필드 비활성
- [ ] 체크 해제 → 금액 직접 입력 가능
- [ ] amount 초과 금액 입력 후 제출 → 클라이언트 에러
- [ ] reasonCode 미선택 후 제출 → "환불 사유를 선택해주세요"
- [ ] 환불 처리 성공 → 모달 닫힘, 목록 새로고침, badge "환불"로 변경
- [ ] Toss 오류 시 → 모달 내 에러 메시지 표시, 모달 유지
