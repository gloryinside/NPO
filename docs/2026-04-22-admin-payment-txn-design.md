# Phase 7-D-2-a — 관리자 수기 납부 + 결제 재시도 (2026-04-22)

## 목적

관리자가 현장에서 현금/계좌이체로 받은 일시 후원을 **수기로 기록**하고,
자동결제 실패(`failed`/`unpaid`) 상태인 payment에 대해 **billingKey 재청구**를
트리거할 수 있게 한다. Phase 7-D(수납 관리 고도화)의 2/3 중 전반부.

**환불(`refunded`)은 본 스펙 범위 외** — 영수증 차감·Toss 부분 취소 룰이
복잡하므로 7-D-2-b로 분리.

---

## 스코프 고정

| 항목 | 결정 |
|---|---|
| 수기 납부 약정 연결 | **auto-promise** — `promises.type='onetime', status='completed'` 자동 생성 후 payment INSERT |
| 재시도 대상 조건 | **엄격** — `pay_status IN ('failed','unpaid') AND promise.toss_billing_key IS NOT NULL`만 허용 |
| 재시도 rate limit | **이중 쿼터** — member 기준 1시간 3회 + payment 기준 하루 5회 (in-memory) |
| 환불 | **범위 외** (7-D-2-b) |

---

## 설계 요약

| 영역 | 신규/수정 | 범위 |
|---|---|---|
| Lib | 신규 `src/lib/payments/manual-create.ts` | auto-promise INSERT + payment INSERT + 롤백 |
| Lib | 신규 `src/lib/payments/retry-charge.ts` | 사전 검증 + rate limit + chargeBillingKey |
| API | 신규 `POST /api/admin/members/[id]/manual-payment` | 수기 납부 1건 생성 |
| API | 신규 `POST /api/admin/payments/[id]/retry` | 특정 payment 재시도 |
| UI | 신규 `src/components/admin/payments/manual-payment-dialog.tsx` | 입력 모달 |
| UI | 신규 `src/components/admin/payments/retry-button.tsx` | 재시도 클라이언트 버튼 |
| UI | 수정 `src/app/(admin)/admin/members/[id]/page.tsx` | 회원 허브에 "수기 납부 기록" 버튼 |
| UI | 수정 `src/components/admin/payment-list.tsx` | 실패 행에 재시도 버튼 |
| 테스트 | 신규 `tests/unit/payments/manual-create.test.ts` | 성공·롤백 분기 |
| 테스트 | 신규 `tests/unit/payments/retry-charge.test.ts` | 조건·rate limit·mock Toss |

**신규 마이그레이션: 0** / **신규 테이블: 0** / **신규 컬럼: 0**

---

## 1. 데이터 계층

### 1.1 `manual-create.ts`

```ts
export interface CreateManualPaymentInput {
  supabase: SupabaseClient
  orgId: string
  memberId: string
  amount: number                 // 원, 1 ≤ n ≤ 100_000_000
  payDate: string                // YYYY-MM-DD
  payMethod: 'cash' | 'transfer' | 'manual'
  campaignId?: string | null
  note?: string | null
}

export type CreateManualPaymentResult =
  | { ok: true; paymentId: string; promiseId: string; paymentCode: string }
  | { ok: false; error:
      | 'INVALID_AMOUNT'
      | 'INVALID_DATE'
      | 'INSERT_FAILED' }

export async function createManualPayment(
  input: CreateManualPaymentInput
): Promise<CreateManualPaymentResult>
```

**흐름**:
1. `amount`: `Number.isFinite`, `1 ≤ amount ≤ 100_000_000`
2. `payDate`: `YYYY-MM-DD` 정규식 검증
3. `promises` INSERT (type=`onetime`, status=`completed`, started_at/ended_at=`payDate`, amount, pay_method)
4. INSERT 실패 → `INSERT_FAILED` 반환
5. `payments` INSERT (promise_id, member_id, amount, pay_date, deposit_date=payDate, pay_status=`paid`, income_status=`pending`, pay_method)
6. payments INSERT 실패 → promises DELETE (best-effort rollback) → `INSERT_FAILED`
7. 성공 시 생성된 `paymentId/promiseId/paymentCode` 반환

**SDK 한계**: Supabase JS는 트랜잭션 미지원 — 순서 기반 롤백. RPC로 바꿀 만한 임계 금액이면 이 lib를 PostgREST function 호출로 대체. 당장은 순서 보증 + best-effort DELETE.

**payment_code 생성**: 기존 `donations/prepare/route.ts`의 `generatePaymentCode` 패턴 재사용.

### 1.2 `retry-charge.ts`

```ts
export interface RetryChargeInput {
  supabase: SupabaseClient
  orgId: string
  paymentId: string
}

export type RetryChargeResult =
  | { ok: true; success: boolean; message: string; tossPaymentKey?: string }
  | { ok: false; error:
      | 'NOT_FOUND'
      | 'INVALID_STATUS'
      | 'BILLING_KEY_MISSING'
      | 'RATE_LIMITED'
      | 'TOSS_UNAVAILABLE'
      retryAfterMs?: number }

export async function retryChargePayment(
  input: RetryChargeInput
): Promise<RetryChargeResult>
```

**흐름**:
1. payment + promise 조인 조회 (promise.toss_billing_key, customer_key, member_id, amount)
2. `pay_status ∉ ('failed','unpaid')` → `INVALID_STATUS`
3. `promise.toss_billing_key` null → `BILLING_KEY_MISSING`
4. Rate limit (in-memory `rateLimit` 헬퍼):
   - `retry:member:${member_id}` 한도 3회 / 1시간
   - `retry:payment:${paymentId}` 한도 5회 / 하루
   - 둘 중 하나라도 초과 → `RATE_LIMITED` + `retryAfterMs`
5. `getOrgTossKeys(orgId)` — secret 없으면 `TOSS_UNAVAILABLE`
6. `chargeBillingKey(secretKey, billingKey, { customerKey, amount, orderId, orderName })` 호출
7. 결과별 업데이트:
   - `result.ok=true`: `payments.update({ pay_status:'paid', deposit_date:today, toss_payment_key, pg_tx_id, fail_reason:null, approved_at:now })`
   - `result.ok=false`: `payments.update({ pay_status:'failed', fail_reason: result.error, updated_at:now })`
8. 반환: `{ ok: true, success: result.ok, message, tossPaymentKey? }`

**chargeBillingKey** 는 `src/lib/billing/toss-billing.ts`에 이미 정의됨(`processMonthlyCharges`가 씀) — 그대로 재사용.

---

## 2. API

### 2.1 `POST /api/admin/members/[id]/manual-payment`

**Request body**:
```json
{
  "amount": 50000,
  "payDate": "2026-04-22",
  "payMethod": "cash",
  "campaignId": null,
  "note": "현장 모금 수거"
}
```

**Response**:
- 200 `{ ok: true, paymentId, promiseId, paymentCode }`
- 400 `{ error: "INVALID_AMOUNT" | "INVALID_DATE" }`
- 404 `{ error: "MEMBER_NOT_FOUND" }`
- 500 `{ error: "INSERT_FAILED" }`

**흐름**:
1. `requireAdminApi()` + tenant 격리
2. body 파싱 + 기본 타입 검증
3. member 존재 + tenant 소속 확인 (`members.org_id = tenant.id`)
4. `createManualPayment` 호출
5. 성공 시 `logAudit('payment.mark_paid', metadata={ manual:true, pay_method, note })`

### 2.2 `POST /api/admin/payments/[id]/retry`

**Request**: body 없음

**Response**:
- 200 `{ ok: true, success: true, message: "재청구 성공", tossPaymentKey }`
- 200 `{ ok: true, success: false, message: "카드 한도 초과" }` — Toss는 비즈니스 정상 (재시도 자체는 수행됨)
- 400 `{ error: "INVALID_STATUS" }`
- 400 `{ error: "BILLING_KEY_MISSING" }`
- 404 `{ error: "NOT_FOUND" }`
- 429 `{ error: "RATE_LIMITED", retryAfterMs }`
- 503 `{ error: "TOSS_UNAVAILABLE" }`

**흐름**:
1. `requireAdminApi()` + tenant 격리
2. payment가 tenant 소속인지 검증
3. `retryChargePayment` 호출
4. 반환 결과 HTTP 매핑
5. 성공/실패 모두 `logAudit('payment.retry_cms', metadata={ success, failure_reason? })`

---

## 3. UI

### 3.1 수기 납부 다이얼로그

**파일**: `src/components/admin/payments/manual-payment-dialog.tsx` (클라이언트)

**필드**:
- 금액 (원, number input, required)
- 납부일 (date input, default today)
- 결제수단 (select: 현금 / 계좌이체 / 기타수기)
- 캠페인 (optional — 기본값: 없음)
- 메모 (textarea, optional)

**동작**:
- `useTransition` 낙관적 UI
- 성공 → 토스트/메시지 + `router.refresh()`
- 에러 5종 한국어 매핑

**버튼 위치**: `/admin/members/[id]` 헤더 액션 영역 — "영수증 발급" 옆에 **"수기 납부 기록"**.

### 3.2 재시도 버튼

**파일**: `src/components/admin/payments/retry-button.tsx` (클라이언트)

**노출 조건** (서버 컴포넌트에서 계산해 prop 전달):
- `pay_status ∈ ('failed','unpaid')` AND
- `promise.toss_billing_key != null`

**UI**:
- 기본: 작은 outline 버튼 "재시도"
- 진행 중: 스피너
- 성공: 녹색 메시지 "재청구 성공" + `router.refresh()`
- Toss 실패: 주황 메시지 "{failure_reason}" + 버튼 다시 활성화
- 에러: 빨간 메시지

**노출 위치**:
- `/admin/members/[id]` 납입이력 탭 각 행
- `/admin/payments` 전체 결제내역 탭 각 행 (확장은 옵션)

---

## 4. 에러 매핑 (UI 한국어)

| 코드 | 한국어 |
|---|---|
| INVALID_AMOUNT | 금액은 1원 이상 1억원 이하여야 합니다. |
| INVALID_DATE | 납부일 형식이 올바르지 않습니다. |
| MEMBER_NOT_FOUND | 후원자를 찾을 수 없습니다. |
| INSERT_FAILED | 납부 기록에 실패했습니다. |
| NOT_FOUND | 결제 정보를 찾을 수 없습니다. |
| INVALID_STATUS | 재시도 가능한 상태가 아닙니다. |
| BILLING_KEY_MISSING | 자동결제 키가 없어 재시도할 수 없습니다. 카드 재등록이 필요합니다. |
| RATE_LIMITED | 최근 재시도 한도를 초과했습니다. 잠시 후 다시 시도해주세요. |
| TOSS_UNAVAILABLE | 결제사 연결에 실패했습니다. 잠시 후 다시 시도해주세요. |

---

## 5. 테스트

### 5.1 `manual-create.ts` 유닛 (vitest)

- 유효 입력 → `promises.insert` 1회 + `payments.insert` 1회 호출
- `amount = 0` → `INVALID_AMOUNT`
- `amount = 1e9` → `INVALID_AMOUNT`
- `payDate = 'invalid'` → `INVALID_DATE`
- `promises.insert` 실패 → payments.insert 호출 없음 + `INSERT_FAILED`
- `payments.insert` 실패 → `promises.delete` 호출 + `INSERT_FAILED`

### 5.2 `retry-charge.ts` 유닛

- `pay_status = 'paid'` → `INVALID_STATUS`
- `toss_billing_key = null` → `BILLING_KEY_MISSING`
- member rate limit 초과 → `RATE_LIMITED`
- payment rate limit 초과 → `RATE_LIMITED`
- `chargeBillingKey` 성공 mock → `payments.update({pay_status:'paid'})` 호출 확인 + `success:true`
- `chargeBillingKey` 실패 mock → `payments.update({pay_status:'failed', fail_reason})` 호출 확인 + `success:false`
- `getOrgTossKeys` 키 없음 → `TOSS_UNAVAILABLE`

### 5.3 통합 테스트

생략 — 실 Toss 호출은 QA 환경에서 수동 검증.

---

## 6. 되돌리기

모든 변경이 추가 only. 되돌리기는 git revert로 충분. DB 변경 없음.

---

## 7. 다음 단계

- **7-D-2-b**: 환불 (paid → refunded)
  - Toss 취소 API (`/v1/payments/{key}/cancel`) 호출 — 기존 donor 경로와 동일 엔드포인트
  - `payments.pay_status='refunded'` + `cancelled_at`
  - 영수증 연동: `receipts` 테이블의 해당 연도 집계에서 차감 (기 발급 시 무효화 정책 별도 검토)
  - 감사 로그 + 알림 이메일 선택
- **7-D-3**: My Page 집약 (donor 측)
