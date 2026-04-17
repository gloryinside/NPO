# Sub-4: 기부금 영수증 자동발급 + 감사 알림톡

**작성일**: 2026-04-17
**범위**: NHN Cloud 알림톡 연동 + 통합 알림 서비스 레이어 + 연말 영수증 일괄 자동발급 + 결제 예정 사전 알림
**상위 프로젝트**: NPO 후원관리시스템 — 후원자 플로우 고도화
**서브프로젝트 순서**: Sub-1 UI/UX (완료) → Sub-2 본인인증 (완료) → Sub-3 빌링 (완료) → **Sub-4 (현재)**

---

## 1. 배경 및 목표

### 현재 상태
- 영수증 PDF 생성 + Supabase Storage 업로드 구현 완료 (`src/lib/receipt/pdf.ts`)
- 관리자 수동 개별/일괄 영수증 발급 UI 존재 (`receipt-bulk-actions.tsx`)
- 결제 확인 시 `receipt_opt_in=true`이면 receipts 행 자동 생성
- 이메일: `sendDonationConfirmed()`, `sendReceiptIssued()` 존재 (Resend 기반)
- NHN Cloud SMS 클라이언트 존재 (`src/lib/sms/nhn-client.ts`)
- 카카오 알림톡: 미구현
- 연말 영수증 일괄 자동발급: 미구현
- 결제 예정 사전 알림: 미구현

### 목표
- NHN Cloud 알림톡 연동 (카카오 비즈메시지)
- 알림톡 4종 템플릿: 후원 감사, 영수증 발급, 결제 실패, 결제 예정 D-3
- 통합 알림 서비스: 알림톡 → SMS 폴백 → 이메일 병행
- 연말 영수증 일괄 자동발급 cron (매년 1월 5일)
- 결제 예정 사전 알림 cron (매일, D-3)

---

## 2. 섹션별 변경 범위

### 섹션 1 — NHN Cloud 알림톡 연동

**NHN Cloud 알림톡 API:**
- 엔드포인트: `https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys/{appKey}/messages`
- 인증: `X-Secret-Key` 헤더
- 환경변수: `NHN_ALIMTALK_APP_KEY`, `NHN_ALIMTALK_SECRET_KEY`, `NHN_ALIMTALK_SENDER_KEY`
- 사전 작업 (수동): 카카오톡 채널 개설 → NHN Cloud 발신 프로필 등록 → 템플릿 4종 검수 승인

**모듈: `src/lib/notifications/alimtalk-client.ts`**
- `sendAlimtalk(phone, templateCode, templateParameter)` → NHN Cloud API 호출
- 응답 성공/실패 판별 → `{ success: boolean; error?: string }` 반환
- 실패 시 자동으로 SMS 폴백하지 않음 (폴백은 상위 `send.ts`에서 처리)

**알림톡 템플릿 4종:**

| 코드 | 시나리오 | 변수 |
|------|---------|------|
| `DONATION_THANKS` | 후원 완료 감사 | `name`, `amount`, `type`(일시/정기), `orgName` |
| `RECEIPT_ISSUED` | 영수증 발급 완료 | `name`, `year`, `link`(PDF URL) |
| `BILLING_FAILED` | 결제 실패 (후원자 알림) | `name`, `amount`, `reason` |
| `BILLING_UPCOMING` | 결제 예정 D-3 사전 알림 | `name`, `date`, `amount` |

**변경 파일:**
- `src/lib/notifications/alimtalk-client.ts` (신규)
- `src/lib/notifications/templates.ts` (신규)

---

### 섹션 2 — 통합 알림 서비스 레이어

**모듈: `src/lib/notifications/send.ts`**

4개 시나리오별 통합 발송 함수:

**`notifyDonationThanks(params)`** — 후원 완료 감사
- params: `{ phone, email, name, amount, type, orgName }`
- 발송: 알림톡 `DONATION_THANKS` (실패 → SMS 폴백) + 이메일 `sendDonationConfirmed()` 병행
- 호출 시점: `src/lib/donations/confirm.ts` — 결제 확인 성공 후

**`notifyReceiptIssued(params)`** — 영수증 발급 완료
- params: `{ phone, email, name, year, pdfUrl, orgName }`
- 발송: 알림톡 `RECEIPT_ISSUED` (실패 → SMS 폴백) + 이메일 `sendReceiptIssued()` 병행
- 호출 시점: 영수증 발급 API + 연말 일괄 발급 cron

**`notifyBillingFailed(params)`** — 결제 실패 (후원자)
- params: `{ phone, email, name, amount, reason, orgName }`
- 발송: 알림톡 `BILLING_FAILED` (실패 → SMS 폴백). 이메일 불필요 (관리자에게는 별도 알림 존재)
- 호출 시점: `src/lib/billing/notifications.ts` — `createBillingFailedNotification` 내부에 추가

**`notifyBillingUpcoming(params)`** — 결제 예정 D-3
- params: `{ phone, name, date, amount }`
- 발송: 알림톡 `BILLING_UPCOMING`만 (실패 → SMS 폴백). 이메일 불필요.
- 호출 시점: `/api/cron/billing-reminder` cron

**발송 전략:**
- 알림톡 시도 → 실패 시 SMS 폴백 (`sendSms`) → 두 채널 다 실패 시 로그만
- 이메일은 알림톡과 별개로 병행 발송 (email이 있는 경우만)
- 모든 발송은 fire-and-forget (호출부의 결제/발급 플로우를 블로킹하지 않음)

**기존 코드 연결:**
- `src/lib/donations/confirm.ts`: 기존 `sendDonationConfirmed()` 호출 위치에 `notifyDonationThanks()` 추가
- `src/lib/billing/notifications.ts`: `createBillingFailedNotification` 내부에 `notifyBillingFailed()` 추가 (후원자 알림)
- 관리자 영수증 발급 API: 기존 `sendReceiptIssued()` 호출 위치에 `notifyReceiptIssued()` 추가

**변경 파일:**
- `src/lib/notifications/send.ts` (신규)
- `src/lib/donations/confirm.ts` (수정 — notifyDonationThanks 추가)
- `src/lib/billing/notifications.ts` (수정 — notifyBillingFailed 추가)
- `src/app/api/admin/receipts/[memberId]/route.ts` (수정 — notifyReceiptIssued 추가)

---

### 섹션 3 — 연말 영수증 일괄 자동발급

**모듈: `src/lib/receipt/annual-batch.ts`**

`issueAnnualReceipts(orgId, year)`:
1. 전년도 `payments`에서 `pay_status='paid'` + `receipt_opt_in=true` → member별 금액 합산
2. 이미 해당 연도 receipts 행이 있는 member 스킵 (중복 방지)
3. 각 대상 member에 대해:
   - `src/lib/receipt/pdf.ts`로 PDF 생성
   - Supabase Storage 업로드
   - `receipts` 테이블 INSERT (year, member_id, total_amount, pdf_url 등)
   - `notifyReceiptIssued()` 발송
4. 반환: `{ issued: number; skipped: number; failed: number }`

**Cron: `/api/cron/issue-annual-receipts`**
- 매년 1월 5일 09:00 KST (01/05 00:00 UTC)
- vercel.json: `"0 0 5 1 *"`
- 모든 org에 대해 `issueAnnualReceipts(orgId, previousYear)` 호출
- CRON_SECRET 인증 (기존 패턴)

**변경 파일:**
- `src/lib/receipt/annual-batch.ts` (신규)
- `src/app/api/cron/issue-annual-receipts/route.ts` (신규)
- `vercel.json` (수정 — cron 추가)

---

### 섹션 4 — 결제 예정 사전 알림 Cron

**Cron: `/api/cron/billing-reminder`**
- 매일 09:00 KST (00:00 UTC)
- KST 기준 3일 후의 day 계산 → 해당 `pay_day`의 active 약정 조회
- 각 약정의 member에게 `notifyBillingUpcoming()` 발송
- 알림톡만 (이메일 불필요)
- vercel.json: `"30 0 * * *"` (process-payments와 겹치지 않도록 30분 오프셋)

**변경 파일:**
- `src/app/api/cron/billing-reminder/route.ts` (신규)
- `vercel.json` (수정 — cron 추가)

---

## 3. 변경하지 않는 것

- 기존 영수증 PDF 생성 로직 (`src/lib/receipt/pdf.ts`)
- 기존 관리자 수동 영수증 발급 UI/API (기능 유지, 알림 추가만)
- 기존 결제 confirm 플로우 (알림 추가만, 결제 로직 변경 없음)
- Sub-1 테마, Sub-2 OTP/본인인증, Sub-3 빌링 서비스
- 관리자 인증, 캠페인 빌더
- 기존 이메일 발송 함수 (`sendDonationConfirmed`, `sendReceiptIssued` — 통합 함수에서 내부 호출)

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 알림톡 발송 실패 (카카오톡 미사용 등) | SMS 폴백 자동 전환 |
| SMS도 실패 (전화번호 없거나 오류) | 이메일만 발송, 로그 남김 |
| 이메일도 없는 후원자 | 알림톡/SMS만 시도, 전부 실패 시 로그만 |
| 연말 일괄 발급 중 PDF 생성 실패 | 해당 member만 failed 카운트, 다음 건 계속 처리 |
| 이미 해당 연도 영수증 발급된 member | 스킵 (receipts year + member_id 중복 확인) |
| 결제 예정 알림 D-3 → pay_day 1~3일 (월말 넘어감) | 다음 달 기준으로 계산, 정상 동작 |
| NHN Cloud 알림톡 API 장애 | SMS 폴백 + 이메일 병행, 로그 남김 |
| 알림톡 템플릿 미검수 상태 | 알림톡 실패 → SMS 폴백으로 정상 운영 |
| 연말 cron 실행 실패 (1/5 장애) | 관리자가 수동 일괄 발급 UI로 대체 가능 |

---

## 5. 범위 밖

- 카카오 친구톡 (마케팅 메시지) — 알림톡과 별도, 향후 필요 시
- 후원자 알림 수신 설정 (알림 거부 옵션) — 향후 마이페이지에 추가
- 국세청 전자 제출 (NTS e-filing) — 기존 bulk export로 대체
