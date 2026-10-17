# 정기후원 자동결제 — 구조 분석과 구현 기록

> 2026-10-16. 근거: 토스페이먼츠 공식 문서(MCP `tosspayments-integration-guide`로 조회)와 이 저장소 코드.
> 도너스·토스도네이션 등 기부 플랫폼의 **내부 구현은 공개되지 않아** 확인할 수 없다. 아래 "업계 공통 구조"는
> 그 플랫폼들이 공통으로 쓰는 PG 자동결제(빌링) 규격 — 토스 공식 문서 — 을 근거로 한 것이다.

## 1. 업계 공통 구조 (토스 자동결제 규격)

```
[후원자 브라우저]                       [우리 서버]                          [토스페이먼츠]
 후원 신청 ──────────────▶ prepare: 약정(pending_billing)+customerKey 저장
            ◀─ {clientKey, customerKey}
 requestBillingAuth('카드') ─────────────────────────────────────────▶ 결제창: 카드 입력·본인인증
 ◀──────────────── successUrl?authKey&customerKey ───────────────────
 /donate/billing/success ─▶ POST /v1/billing/authorizations/issue ──▶ billingKey 발급
                            빌링키 암호화 저장, 약정 active
 (매월, 크론)               POST /v1/billing/{billingKey}  + Idempotency-Key ─▶ 승인(Payment 객체)
                            status=DONE·금액 일치 확인 후 paid
 (상태 변경 시)             ◀── 웹훅(서명 없음) ── GET /v1/payments/{paymentKey}로 재확인
 (해지·카드변경·탈퇴)        DELETE /v1/billing/{billingKey}
```

| 규격 요점 | 근거(토스 문서) | 이 프로젝트 반영 |
|---|---|---|
| customerKey는 유추 불가 무작위 값(UUID) | 코어 API — customerKey 설명 | `randomUUID()` (기존 유지) |
| 빌링키는 재조회 불가, customerKey와 짝이 맞아야 결제 | 빌링 API 연동 2장 | 빌링키 **암호화 저장**(`billing-key-store.ts`) |
| 스케줄링은 가맹점 책임 | 빌링 API 연동 3장 | `process-payments` 크론(+누락분 따라잡기) |
| 멱등키 헤더로 중복 승인 방지 | 블로그 "멱등성이 뭔가요?" · 멱등키 헤더 | `Idempotency-Key: npo-charge-{paymentId}-{시도}` |
| orderId 영문·숫자·-·_ 6~64자, 주문마다 고유 | 코어 API — orderId | `toTossOrderId()`, 재시도는 `-R{n}` |
| 카드 재발급·변경은 새 빌링키 발급, 안 쓰는 키는 삭제 | 빌링 FAQ · 빌링키 삭제 API | 카드 변경·해지·탈퇴 시 `DELETE /v1/billing/{key}` |
| 결제 상태 웹훅엔 서명 없음, 10초 내 200, 최대 7회 재전송 | 웹훅 연결하기 · 웹훅 이벤트 | 결제 조회 API로 재확인 + transmission-id 1회 처리 |
| 결제창 방식이 카드정보를 가맹점이 받지 않음(키인은 별도 계약) | 자동결제 결제창 연동 | 신청·카드변경 모두 `requestBillingAuth`로 전환 |

## 2. 발견한 문제와 조치

| 심각도 | 문제 | 조치 |
|---|---|---|
| 치명 | 월 청구가 한 번도 실행되지 않음 — 크론은 `unpaid`를 만들고 청구는 `pending`만 찾음 | 청구 대상 `unpaid`로 통일 |
| 치명 | 주문번호로 없는 컬럼(`payment.code`) 전달 → 토스 거절 | 시도별 orderId 생성 |
| 치명 | 신청 시 약정 insert가 필수 컬럼 누락으로 실패, 오류 무시 → 빌링키 유실 | `insertPromise()`(코드 생성·재시도), 실패 시 토스 키 삭제 |
| 치명 | 운영에서 크론 10개가 401 — Vercel은 `Authorization: Bearer`를 보내는데 `x-cron-secret`만 확인 | 공용 `cronSecretMatches()` (월 청구·재시도·연말 영수증 포함) |
| 치명(보안) | `/api/donations/[id]/webhooks` 무서명 — 누구나 결제 완료 처리 가능 | 토스 결제 조회로 검증한 값만 반영, 검증 불가 PG 거부 |
| 높음 | 토스 웹훅이 토스가 보내지 않는 HMAC을 요구 → 운영에서 전부 거부 | 결제 조회 재확인 모델로 교체 |
| 높음 | 3개 결제 경로(월 청구·자동 재시도·수동 재시도) 동시 실행 시 이중 결제 | `chargePayment()` 단일화: 선점(claim)+멱등키+조건부 기록 |
| 높음 | 응답 금액 미검증 | DONE·금액 일치만 성공, 불일치는 재시도 금지·검토 |
| 높음 | 재시도가 해지·정지 약정도 청구 | 자동 경로는 active만 |
| 높음 | 빌링키 평문 저장 | pgcrypto 암호화(`enc:` 접두사), 기존 키는 1회성 라우트로 이전 |
| 높음 | 카드 변경·해지·탈퇴 시 토스 키 미삭제 | `revokePromiseBilling()` + 남은 미결제 취소 |
| 높음 | 카드번호를 우리 서버가 받음(키인) | 결제창 방식으로 전환 |
| 중간 | 크론 하루 실패 시 그 달 청구 누락 / 결제 코드 경쟁 | 같은 달 따라잡기, UNIQUE 충돌 재시도 |
| 중간 | 시간대: 결제일·재개일·만료 알림이 UTC 기준 | `kst.ts` 공용 함수 |
| 중간 | 카드 만료 알림 매일 재발송(중복방지 kind 불일치) / stale 정리 크론이 없는 컬럼 사용 | kind 정합, `pay_status` |

## 3. 내린 결정 (표준 + 추천)

1. **카드 등록은 결제창(requestBillingAuth)이 기본.** 키인 경로는 하위 호환으로 남김(카드번호가 오면 동작).
   토스 자동결제 계약이 "결제창 빌링"인지 기관별로 확인 필요.
2. **재시도 정책 1·3·7일, 최대 3회 → 약정 정지.** 카드 정지·빌링키 무효·금액 불일치는 재시도 없이 즉시 검토.
3. **결과 불명(네트워크)은 시도 번호를 올리지 않음** — 다음 실행이 같은 멱등키로 결과를 회수(중복 승인 없음).
4. **결제 실패로 정지된 약정은 새 카드 등록 시 자동 재개**, 후원자가 직접 멈춘 약정(`suspended_until`)은 유지.
5. **첫 달 청구 시점**: 신청일이 이번 달 결제일 이후면 다음 달부터(가입 즉시 청구 안 함 — 기존 동작 유지).

## 4. 적용 순서

1. 마이그레이션 `20261016000003_billing_charge_safety.sql` (선점·주문번호 컬럼, 웹훅 중복 인덱스)
   — **적용 전에는 자동 청구가 fail-safe로 건너뜀**(선점 UPDATE가 컬럼 없음으로 실패 → 결제 안 함).
2. 배포 후 1회: `GET /api/cron/encrypt-billing-keys` (Bearer CRON_SECRET) — 평문 빌링키 암호화, 0건 될 때까지.
3. 토스 개발자센터 웹훅 URL: `https://<도메인>/api/webhooks/toss` (기관 MID별 등록).
