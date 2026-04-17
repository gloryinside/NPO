# Sub-3: 정기후원 CMS — Toss Billing 자동결제

**작성일**: 2026-04-17
**범위**: 빌링키 발급 + 월간 자동결제 + 실패 재시도 + 관리자 알림
**상위 프로젝트**: NPO 후원관리시스템 — 후원자 플로우 고도화
**서브프로젝트 순서**: Sub-1 UI/UX (완료) → Sub-2 본인인증 (완료) → **Sub-3 (현재)** → Sub-4 영수증+알림
**환경**: Toss Payments 테스트키 (`test_sk_...`)

---

## 1. 배경 및 목표

### 현재 상태
- `promises` 테이블에 `toss_billing_key` 컬럼이 존재하지만 미사용
- cron (`/api/cron/process-payments`): 매일 09:00 KST — active 약정에서 pay_day 매칭 → unpaid payment 행 생성
- 실제 자동결제(빌��키 결제) 미구현 — unpaid 행만 생성되고 끝
- 정기후원 첫 결제: 일시후원과 동일한 일반 카드 결제

### 목표
- 정기후원 첫 결제 성공 후 Toss 빌링키 자동 발급
- 매월 pay_day에 빌링키로 자동결제 수행
- 결제 실패 시 1일/3일/7일 간격 3회 재시도, 3회 실패 시 약정 정지
- 관리자에게 인앱 + 이메일 알림 (수동 연락 유도)
- 빌링 로직을 `src/lib/billing/`로 분리하여 테스트 용이하게

---

## 2. 섹션별 변경 범위

### 섹션 1 — Toss 빌링키 발급 플로우

**플로우 (테스트키 환경):**
1. 위저드 Step2에서 정기후원 선택 시 카드 정보 입력 필드 노출
   - 카드번호, 유효기간(MM/YY), 생년월일(6자리), 비밀번호 앞 2자리
   - 테스트키 전용 — 실 서비스 전환 시 Toss 인증 플로우로 교체
2. `/api/donations/prepare`에서 정기후원 + 카드 정보 수신 시:
   - Toss `POST /v1/billing/authorizations/card`로 빌링키 발급
   - 빌링키를 promise의 `toss_billing_key`에 저장
   - 첫 결제는 기존 일반 Toss 결제로 진행 (사용자 경험 유지)
3. 빌링키 발급 실패 시: 첫 결제는 유지, 빌링키 미저장, 다음 달 수동 처리

**Toss Billing API (테스트):**
- 빌링키 발급: `POST https://api.tosspayments.com/v1/billing/authorizations/card`
  - Headers: `Authorization: Basic {base64(secretKey:)}`
  - Body: `{ customerKey, cardNumber, cardExpirationYear, cardExpirationMonth, cardPassword, customerIdentityNumber }`
  - Response: `{ billingKey, customerKey, ... }`
- 자동결제: `POST https://api.tosspayments.com/v1/billing/{billingKey}`
  - Body: `{ customerKey, amount, orderId, orderName }`
  - Response: `{ paymentKey, orderId, status, ... }`

**위저드 Step2 변경:**
- `state.type === 'regular'` 일 때 카드 정보 입력 섹션 표시
- 카드번호: 4자리씩 4칸 (16자리)
- 유효기간: MM/YY 형식
- 생년월일: 6자리 숫자
- 비밀번호: 앞 2자리 (마스킹)
- 이 정보는 서버로 전달 후 ��시 사용, 저장하지 않음

**변경 파일:**
- `src/app/donate/wizard/steps/Step2.tsx` (수정 — 카드 정보 입력)
- `src/app/api/donations/prepare/route.ts` (수정 — 빌링키 발급 + promise 저장)
- `src/lib/billing/toss-billing.ts` (신규)

---

### 섹션 2 — 빌링 서비스 레이어

**모듈: `src/lib/billing/`**

**`toss-billing.ts` — Toss Billing API 래퍼:**
```typescript
issueBillingKey(secretKey, cardInfo): Promise<{ billingKey: string; customerKey: string } | null>
chargeBillingKey(secretKey, billingKey, params): Promise<{ success: boolean; paymentKey?: string; failureCode?: string; failureMessage?: string }>
```

**`charge-service.ts` — 월간 자동결제:**
```typescript
processMonthlyCharges(orgId: string): Promise<{ charged: number; failed: number }>
```
- 오늘이 pay_day인 active 약정 조회 (toss_billing_key가 있는 것만)
- 각 약정에 대해 idempotency key 확인 → 미납 payment 생성 → `chargeBillingKey` 호출
- 성공: `pay_status` → `paid`, `toss_payment_key` 저장
- 실패: `pay_status` → `failed`, `retry_count` = 0, `next_retry_at` = +1일

**`retry-service.ts` — 실패 재시도:**
```typescript
processRetries(orgId: string): Promise<{ retried: number; suspended: number }>
```
- `pay_status === 'failed'` AND `next_retry_at <= now` AND `retry_count < 3` 조회
- 재시도 → 성공: `pay_status` → `paid`
- 재시도 → 실패:
  - `retry_count` 1 → `next_retry_at` = +3일
  - `retry_count` 2 → `next_retry_at` = +7일
  - `retry_count` 3 → 약정 `status` → `suspended`, 관리자 알림 생성 + 이메일

**변경 파일:**
- `src/lib/billing/toss-billing.ts` (신규)
- `src/lib/billing/charge-service.ts` (신규)
- `src/lib/billing/retry-service.ts` (신규)

---

### 섹션 3 — DB 변경 + Cron 확장

**DB 변경:**

`payments` 테이블 컬럼 추가:
- `retry_count INT NOT NULL DEFAULT 0`
- `next_retry_at TIMESTAMPTZ`

`admin_notifications` 테이블 신규:
- `id` UUID PK DEFAULT gen_random_uuid()
- `org_id` UUID FK REFERENCES orgs(id)
- `type` TEXT NOT NULL (e.g. 'billing_failed', 'pledge_suspended')
- `title` TEXT NOT NULL
- `body` TEXT NOT NULL
- `read` BOOLEAN NOT NULL DEFAULT FALSE
- `meta` JSONB (관련 payment_id, promise_id 등 참조)
- `created_at` TIMESTAMPTZ DEFAULT now()

마이그레이션 파일:
- `supabase/migrations/YYYYMMDD_payments_retry.sql`
- `supabase/migrations/YYYYMMDD_admin_notifications.sql`

**Cron 확장 (`/api/cron/process-payments`):**
- 기존 로직 유지: active 약정 → unpaid payment 행 생성
- 추가: payment 생성 후 `toss_billing_key`가 있으면 `chargeService.processMonthlyCharges()` 호출
- `toss_billing_key` 없는 약정 (오프라인 등)은 기존처럼 unpaid 행만 생성

**재시도 Cron 신규 (`/api/cron/retry-billing`):**
- Vercel Cron: 매일 10:00 KST (01:00 UTC)
- `retryService.processRetries()` 호출
- `vercel.json`에 cron 스케줄 ���가

**변경 파일:**
- `supabase/migrations/YYYYMMDD_payments_retry.sql` (신규)
- `supabase/migrations/YYYYMMDD_admin_notifications.sql` (신규)
- `src/app/api/cron/process-payments/route.ts` (수정 — 자동결제 연동)
- `src/app/api/cron/retry-billing/route.ts` (신규)
- `vercel.json` (수정 — retry-billing cron 추가)

---

### 섹션 4 — 관리자 알림 시스템

**인앱 알림:**
- `admin_notifications` 테이블에 INSERT
- 관리자 대시보드 상단에 알림 배지 (읽지 않은 개수)
- `/admin/notifications` 페이지: 알림 목록, 읽음 처리

**이메일 알림:**
- 결제 실패 시: 관리자 이메일로 발송
- 약정 정지 시: 별도 이메일 (후원자 이름, 금액, 실패 사유, 연락처 포함)
- 이메일 발송 모듈: `src/lib/email/send-email.ts` (신규)
  - NHN Cloud Email API 또는 간단한 SMTP (Nodemailer) — 환경변수로 설정

**알림 API:**
- `GET /api/admin/notifications` — 목록 조회 (페이지네이션)
- `PATCH /api/admin/notifications/[id]/read` — 읽음 처리
- `GET /api/admin/notifications/unread-count` — 읽지 않은 개수 (배지용)

**관리자 UI:**
- 네비게이션 바에 알림 벨 아이콘 + 배지
- `/admin/notifications` 페이지: 카드형 알림 목록, 타입별 아이콘, 시간 표시
- 기존 약정 관리: `suspended` 상태 표시 + "재활성화" 버튼

**변경 파일:**
- `src/lib/email/send-email.ts` (신규)
- `src/app/api/admin/notifications/route.ts` (신규)
- `src/app/api/admin/notifications/[id]/read/route.ts` (신규)
- `src/app/api/admin/notifications/unread-count/route.ts` (신규)
- `src/app/(admin)/admin/notifications/page.tsx` (신규)
- 관리자 레이아웃 네���게이션 (수정 — 알림 배지)

---

## 3. 변경하지 않는 것

- 일시후원 결제 플로우 (기존 그대로)
- 오프라인 결제 (계좌이체/수기 — 빌링키 없이 수동 처리)
- Sub-1 테마 시스템, 공유 컴포넌트
- Sub-2 OTP 인증, 본인인증
- 캠페인 빌더, 블록 렌더러

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 빌링키 발급 실패 (첫 결제 성공) | 첫 결제 유지, 빌링키 미저장, 다음 달 수동 처리, 관리자 알림 |
| cron 중 Toss API 타임아웃 | 해당 건만 failed 처리, 재시도 대상 전환 |
| 카드 만료 | 자동결제 실패 → 재시도 3회 → 정지 → 관리자 연락 |
| 동일 월 cron 중복 실행 | idempotency key (`cron-{promiseId}-{YYYY-MM}`)로 방지 |
| 약정 해지 후 cron 실행 | `status === 'active'` 필터링, 해지 약정 무시 |
| 약정 재활성화 | 관리자가 `suspended` → `active`, 다음 pay_day부터 재개 |
| pay_day 29-31일 약정 | promises 스키마 제약 1-28, 문제 없음 |
| 테스트키 → 실키 전환 | `toss-billing.ts`의 `issueBillingKey` 함수만 교체 (카드 직접 입력 → Toss 인증 플로우) |
| 이메일 발송 실패 | 인앱 알림은 항상 저장, 이메일 실패 시 로그만 남기고 진행 |

---

## 5. 범위 밖 (다음 Sub-project)

- Sub-4: 기부금 영수증 자동발급 + 감사 이메일/알림톡
