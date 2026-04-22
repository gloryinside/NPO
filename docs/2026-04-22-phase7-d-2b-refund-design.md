# Phase 7-D-2-b: 관리자 환불 처리 설계 스펙

## 1. 배경 및 목적

관리자가 온라인 결제(Toss)된 납입 건에 대해 전액 또는 부분 환불을 처리할 수 있는 기능. 후원자 셀프 환불은 범위 외. 오프라인 결제(toss_payment_key 없음)는 환불 불가.

## 2. 결정 사항

| 항목 | 결정 |
|------|------|
| 환불 주체 | 관리자만 |
| 환불 유형 | 전액 + 부분 금액 지정 |
| 환불 기간 제한 | Toss PG 정책 따름 (별도 기간 검증 없음, API 오류로 처리) |
| 오프라인 결제 | 환불 불가 (400 반환) |
| 환불 사유 | 선택지(4종) + 자유 텍스트 메모 (선택) |

## 3. DB 스키마 변경

### Migration: `supabase/migrations/20260423000002_payments_refund_columns.sql`

```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS cancelled_at  timestamptz,
  ADD COLUMN IF NOT EXISTS refund_amount bigint,
  ADD COLUMN IF NOT EXISTS cancel_reason text;
```

- `cancelled_at`: 환불/취소 처리 시각
- `refund_amount`: 부분 환불 금액. NULL이면 전액 환불
- `cancel_reason`: `{reasonCode}:{reasonNote}` 형식으로 저장 (예: `"donor_request:후원자 변심"`)
- `pay_status` CHECK의 `'refunded'` 값은 기존 스키마에 이미 존재

## 4. API

### `POST /api/admin/payments/[id]/refund`

**Request body:**
```typescript
{
  refundAmount?: number;   // 미입력 시 전액 (payments.amount 사용)
  reasonCode: "donor_request" | "duplicate" | "error" | "other";
  reasonNote?: string;     // 자유 텍스트 메모 (선택)
}
```

**처리 흐름:**
1. `requireAdminUser()` → 401
2. `requireTenant()` → 400
3. payments 조회: `id` + `org_id` 매칭, 없으면 404
4. `pay_status !== 'paid'` → 400 "환불 가능한 상태가 아닙니다"
5. `toss_payment_key IS NULL` → 400 "온라인 결제만 환불 가능합니다"
6. `reasonCode` 유효성 검증 → 400
7. `refundAmount` 검증: `0 < refundAmount <= payments.amount` → 400
8. org_secrets에서 `toss_secret_key_enc` 복호화
9. **Toss cancel API 호출:**
   ```
   POST https://api.tosspayments.com/v1/payments/{toss_payment_key}/cancel
   Body: { cancelReason, cancelAmount? }
   ```
   - `cancelReason`: `REASON_LABELS[reasonCode]` (한국어 레이블) + reasonNote가 있으면 ` - ${reasonNote}` 접미
   - 전액: `cancelAmount` 생략
   - 부분: `cancelAmount: refundAmount`
   - Toss 실패 → 500 반환, DB 변경 없음
10. Toss 성공 → DB update:
    ```typescript
    {
      pay_status: 'refunded',
      refund_amount: refundAmount ?? null,   // 전액이면 null
      cancelled_at: new Date().toISOString(),
      cancel_reason: reasonNote
        ? `${reasonCode}:${reasonNote}`
        : reasonCode,
    }
    ```
11. audit_log 기록:
    ```typescript
    {
      action: "payment.refund",
      summary: `환불 처리 (${refundAmount ? refundAmount + '원 부분환불' : '전액환불'})`,
      metadata: { refund_amount: refundAmount ?? payment.amount, reason_code: reasonCode }
    }
    ```
    DB update 실패 시: audit_log에 Toss 취소 성공 기록 포함 후 500 반환
12. `200 { ok: true }`

**사유 코드 레이블:**
```typescript
const REASON_LABELS = {
  donor_request: "후원자 요청",
  duplicate: "중복 결제",
  error: "오류",
  other: "기타",
} as const;
```

## 5. UI

### 5-1. `PaymentList` 수정 (`src/components/admin/payment-list.tsx`)

- 행 액션 영역에 "환불" 버튼 추가
- 표시 조건: `payment.pay_status === 'paid' && payment.toss_payment_key != null`
- 클릭 → `selectedRefundPayment` state 세팅 → `RefundDialog` 오픈
- 환불 완료 콜백: `router.refresh()` (기존 수기 납부와 동일 패턴)
- 행의 "환불" badge: 기존 `refunded` 스타일(`--warning-soft` / `--warning`) 그대로 사용
- 환불 행 툴팁 (badge 옆):
  - `refund_amount !== null` → "부분환불 {n}원"
  - `refund_amount === null` → "전액환불"
  - `cancel_reason` 있으면 tooltip에 사유 표시

### 5-2. `RefundDialog` 신규 (`src/components/admin/refund-dialog.tsx`)

Props:
```typescript
interface RefundDialogProps {
  payment: {
    id: string;
    amount: number;
    pay_date: string;
    toss_payment_key: string;
    members?: { name: string } | null;
  } | null;
  onClose: () => void;
  onRefunded: () => void;
}
```

UI 구조:
```
┌─────────────────────────────────────┐
│ 환불 처리                            │
│ 후원자: 홍길동 | 결제일: 2026-04-01  │
│ 결제금액: 100,000원                  │
├─────────────────────────────────────┤
│ 환불금액  [______100,000______] 원   │
│           ☑ 전액 환불 (체크 시 비활성)│
│                                     │
│ 환불사유 *                          │
│  ○ 후원자 요청                      │
│  ○ 중복 결제                        │
│  ○ 오류                             │
│  ○ 기타                             │
│                                     │
│ 메모 (선택)  [________________]      │
│                                     │
│         [취소]    [환불 처리 →]      │
└─────────────────────────────────────┘
```

상태:
- `isFullRefund: boolean` (default true) — 체크 시 금액 입력 비활성화
- `refundAmount: string` — 직접 입력 시 isFullRefund=false
- `reasonCode: string` — 필수
- `reasonNote: string` — 선택
- `loading: boolean`, `error: string | null`

검증 (클라이언트):
- `reasonCode` 미선택 → "환불 사유를 선택해주세요"
- `refundAmount` 직접 입력 시 0 이하 또는 amount 초과 → "유효한 금액을 입력해주세요"

## 6. 테스트

### `tests/unit/admin/refund.test.ts` (8개)

| # | 설명 | 기대 |
|---|------|------|
| 1 | `refundAmount > amount` | 400 |
| 2 | `refundAmount <= 0` | 400 |
| 3 | `toss_payment_key` 없는 결제 | 400 "온라인 결제만 환불 가능합니다" |
| 4 | `pay_status !== 'paid'` | 400 |
| 5 | Toss API 실패 | 500, DB 변경 없음 |
| 6 | 전액 환불 성공 | `pay_status='refunded'`, `refund_amount=null`, audit log 기록 |
| 7 | 부분 환불 성공 | `refund_amount=50000`, `cancel_reason` 저장 |
| 8 | `reasonCode` 누락 | 400 |

## 7. 제외 범위 (YAGNI)

- 후원자 셀프 환불 (기존 7일 취소 로직과 별개, 이번 범위 외)
- 오프라인 결제 수동 환불 처리 UI
- 환불 이력 별도 페이지
- 이메일 알림 (환불 완료 후 후원자 통보) — 별도 Phase

## 8. 수동 QA 체크리스트

- [ ] paid + toss_payment_key 있는 행에만 "환불" 버튼 노출
- [ ] paid + toss_payment_key 없는 행에 버튼 미노출
- [ ] refunded 상태 행에 버튼 미노출
- [ ] 전액 환불 체크 → 금액 입력 비활성화 + amount 자동 세팅
- [ ] 체크 해제 → 금액 직접 입력 가능
- [ ] amount 초과 금액 입력 → 클라이언트 에러
- [ ] reasonCode 미선택 → 클라이언트 에러
- [ ] 환불 성공 → 목록 새로고침, badge "환불"로 변경
- [ ] 환불 성공 → 툴팁에 환불금액/사유 표시
- [ ] Toss 오류 시 → 모달 내 에러 메시지 표시
