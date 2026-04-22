# GAP 분석 — Phase 7-D-2-a 수기 납부 + 결제 재시도 (2026-04-22)

Spec: `docs/2026-04-22-admin-payment-txn-design.md`.
Phase 7-D-2 수납 트랜잭션의 전반부. 환불(`refunded`)은 영수증 차감 룰 때문에
7-D-2-b로 분리.

---

## 구현 개요

### 1. 수기 납부 생성

**신규 lib**: `src/lib/payments/manual-create.ts`
- auto-promise 전략: `promises(type='onetime', status='completed')` 행을 자동 생성 후 payment INSERT
- Supabase SDK 트랜잭션 미지원이므로 순서 보증 + best-effort 롤백 (promises DELETE)
- 입력 검증: amount 1원~1억, YYYY-MM-DD 날짜, pay_method ∈ {cash, transfer, manual}
- 반환: `{ paymentId, promiseId, paymentCode }` — code는 `generatePaymentCode` 재사용
- **테스트 9/9** — 유효 입력·경계·롤백 분기

**신규 API**: `POST /api/admin/members/[id]/manual-payment`
- `requireAdminApi` + tenant 격리 + member 소속 검증
- 감사 로그 `payment.mark_paid` + `metadata.manual = true`
- 에러 분기: `INVALID_JSON/METHOD/AMOUNT/DATE/MEMBER_NOT_FOUND/INSERT_FAILED`

**UI**: `src/components/admin/payments/manual-payment-dialog.tsx`
- 금액·날짜·결제수단·메모 4필드 다이얼로그
- `useTransition` 낙관적 UI + 에러 한국어 매핑
- 회원 허브 헤더에서 트리거 — "수기 납부 기록" 버튼

### 2. 결제 재시도

**신규 lib**: `src/lib/payments/retry-charge.ts`
- 엄격 조건: `pay_status IN ('failed','unpaid')` AND `promise.toss_billing_key IS NOT NULL`
- **이중 rate limit**: member 1h/3회 + payment 1d/5회 (in-memory `rateLimit` 헬퍼)
- 기존 `chargeBillingKey`/`getOrgTossKeys` 재사용 — processMonthlyCharges와 Toss 통합 경로 공유
- Toss 비즈니스 실패는 `{ok: true, success: false, message}` 로 정상 응답 (HTTP 200)
- 인프라 실패(Toss 키 없음)만 5xx → `TOSS_UNAVAILABLE`
- **테스트 9/9** — 5개 사전검증 분기 + 성공/실패 update 호출 검증 + rate limit (payment/member 각각)

**신규 API**: `POST /api/admin/payments/[id]/retry`
- body 없음, URL로만 identify
- HTTP 매핑: `NOT_FOUND=404, INVALID_STATUS/BILLING_KEY_MISSING=400, RATE_LIMITED=429, TOSS_UNAVAILABLE=503`
- 감사 로그 `payment.retry_cms` + `metadata.success`

**UI**: `src/components/admin/payments/retry-button.tsx`
- 회원 허브 납입이력 탭에 "액션" 컬럼 추가
- 노출 조건(서버 계산): `retryable = pay_status ∈ {failed, unpaid} && promise.toss_billing_key`
- 3-state 결과 표시 (success 녹색 / failed 주황 / error 빨강)
- 행 클릭 버블 차단(`stopPropagation`)으로 의도치 않은 상세 네비게이션 방지

### 3. 데이터 모델 변경

**0건** — 신규 마이그레이션 / 테이블 / 컬럼 없음. 기존 `promises` / `payments` 구조 그대로 사용.

---

## 안전장치 정리

| 리스크 | 대응 |
|---|---|
| 수기 납부 롤백 (SDK 트랜잭션 없음) | 순서 보증 + promises DELETE best-effort. 임계 금액 요구 시 PostgREST function으로 이식 |
| 중복 재청구 (관리자 실수 더블클릭) | member 1h/3회 + payment 1d/5회 이중 쿼터. 버튼 자체는 `isPending` 중 disabled |
| Toss 네트워크 장애 | `chargeBillingKey`가 예외를 catch해 `success:false + NETWORK_ERROR` 반환 → UI에 재시도 안내 |
| 권한 escalation | `requireAdminApi` + tenant 격리로 cross-tenant 차단 |
| 감사 추적 | 둘 다 `logAudit` fire-and-forget 기록 — 성공/실패 모두 |

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **194 passed** (신규 18 — manual-create 9 + retry-charge 9) |
| 신규 파일 | 6 (lib 2 + API 2 + UI 2) |
| 수정 파일 | 1 (`/admin/members/[id]/page.tsx` — 헤더 버튼 + 납입이력 액션 컬럼) |
| 신규 API | 2 (`manual-payment`, `retry`) |
| 마이그레이션 | 0 |
| 빌드 | 성공 |

---

## Phase 7-D-2-a 완료 선언

- ✅ 수기 납부 기록: 현금/계좌이체/기타 접수분을 회원 허브 1클릭으로 payments에 기록
- ✅ 결제 재시도: 실패한 자동결제를 상담 중 즉시 재청구 (배치 cron 대기 불필요)
- ✅ auto-promise 정책으로 기존 스키마 invariant(`payment → promise` 조인) 유지
- ✅ 이중 rate limit으로 관리자 실수·중복 청구 방지

---

## 남은 리스크 (2건)

### 중간

#### G-124. 수기 납부 영수증 연동
- 연도별 `receipts` 집계에 수기 납부도 자동 포함되는지 확인 필요
- **해결**: receipts 발급 쿼리가 `payments WHERE pay_status='paid'`를 기준이면 자동 포함. 아니라면 `manual=true` 메타 플래그로 예외 처리
- **우선순위**: 중간 (연말정산 시즌 전)

### 낮음

#### G-125. 재시도 결과 알림 부재
- 관리자 재시도 성공/실패 시 후원자에게 알림 메일 자동 발송 없음
- 배치 `processRetries`에서는 `createBillingFailedNotification` 호출되지만 수동 경로에는 없음
- **해결**: retry API에서 실패 결과일 때 `createBillingFailedNotification` 호출 추가. 성공 시 감사 메일은 별도 정책
- **우선순위**: 낮음 (관리자가 직접 후원자 연락하는 전제)

---

## 다음 단계

- **Phase 7-D-2-b**: 환불 (`paid → refunded`)
  - Toss 취소 API (`/v1/payments/{key}/cancel`) — 기존 donor 7일 취소 경로와 동일 엔드포인트
  - 영수증 연동: 기 발급 영수증은 무효화 vs 재발급 정책 결정 필요
  - 부분환불 지원 여부 결정
- **Phase 7-D-3**: My Page 집약 (donor 측)
  - 7-D-1에서 확정한 account-state를 donor 본인에게도 노출
  - 결제 내역/영수증/약정 관리를 donor 홈에서 집약
