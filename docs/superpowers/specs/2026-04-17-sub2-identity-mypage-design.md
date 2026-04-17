# Sub-2: 본인인증 + 비회원 마이페이지 통합

**작성일**: 2026-04-17
**범위**: SMS OTP 간편 로그인 + 토스 본인인증(영수증용) + 통합 마이페이지 확장 + 후원 취소/해지
**상위 프로젝트**: NPO 후원관리시스템 — 후원자 플로우 고도화
**서브프로젝트 순서**: Sub-1 UI/UX 고도화 (완료) → **Sub-2 (현재)** → Sub-3 정기후원 CMS → Sub-4 영수증+알림

---

## 1. 배경 및 목표

### 현재 상태
- 후원자 로그인: Supabase 이메일/비밀번호 방식 (`/donor/login`, `/donor/signup`)
- 마이페이지: `/donor` — 후원 내역, 약정, 프로필 수정 (회원 전용)
- 비회원 후원: 위저드에서 이름/연락처만 입력하고 결제 가능하지만, 이후 내역 조회 불가
- 본인인증: 없음. 기부금 영수증용 주민번호 직접 입력 방식
- 후원 취소/해지: 관리자만 가능, 후원자 셀프서비스 없음

### 목표
- 비회원도 휴대폰 OTP로 마이페이지 접근 가능
- 기부금 영수증 발급 시 토스 본인인증으로 실명 확인 (주민번호 직접 입력 제거)
- 기존 회원 마이페이지와 통합 — 하나의 UI, 인증 방식만 다름
- 후원자 셀프서비스: 일시후원 취소, 정기후원 해지

---

## 2. 섹션별 변경 범위

### 섹션 1 — SMS OTP 인증 시스템

**DB 변경:**
- `otp_codes` 테이블 신규:
  - `id` UUID PK
  - `org_id` UUID FK (테넌트 격리)
  - `phone` TEXT (인덱스)
  - `code` TEXT (6자리 숫자)
  - `expires_at` TIMESTAMPTZ (생성 후 5분)
  - `attempts` INT DEFAULT 0 (검증 시도 횟수)
  - `verified` BOOLEAN DEFAULT FALSE
  - `created_at` TIMESTAMPTZ DEFAULT now()
- 마이그레이션 파일: `supabase/migrations/YYYYMMDD_otp_codes.sql`

**Rate Limit 정책:**
- 동일 번호 1분 내 재발송 차단
- 동일 번호 5회 연속 검증 실패 → 30분 잠금 (otp_codes에서 최근 5건 확인)

**NHN Cloud SMS 연동:**
- 환경변수: `NHN_SMS_APP_KEY`, `NHN_SMS_SECRET_KEY`, `NHN_SMS_SENDER`
- 모듈: `src/lib/sms/nhn-client.ts` (신규)
  - `sendSms(phone: string, body: string): Promise<boolean>`
  - NHN Cloud Notification SMS API v3.0 호출

**API:**

`POST /api/auth/otp/send`
- Body: `{ phone: string }`
- 로직:
  1. phone 형식 검증 (한국 번호)
  2. rate limit 확인 (1분 이내 기존 코드 있으면 429)
  3. 6자리 랜덤 코드 생성 (`crypto.randomInt(100000, 999999)`)
  4. `otp_codes` INSERT
  5. NHN Cloud SMS 발송: `[기관명] 인증번호: {code} (5분 이내 입력)`
  6. 응답: `{ ok: true }` (코드는 응답에 포함하지 않음)

`POST /api/auth/otp/verify`
- Body: `{ phone: string, code: string }`
- 로직:
  1. `otp_codes`에서 해당 phone의 최근 미인증 코드 조회
  2. 30분 잠금 확인 (최근 5건 attempts 합산)
  3. 코드 + expires_at 검증
  4. 실패 시 attempts++ → 에러 응답
  5. 성공 시 verified=true → `members` 테이블에서 phone + org_id 매칭
  6. 매칭 실패 → `{ ok: false, reason: 'no_member' }`
  7. 매칭 성공 → JWT 생성 (`{ memberId, orgId, phone, exp: 24h }`) → `donor-otp-session` httpOnly 쿠키 설정 → `{ ok: true }`

**JWT 세션:**
- 서명 키: `OTP_JWT_SECRET` 환경변수
- 쿠키: `donor-otp-session`, httpOnly, secure, sameSite=lax, maxAge=86400
- 모듈: `src/lib/auth/otp-session.ts` (신규)
  - `signOtpToken(payload): string`
  - `verifyOtpToken(token): OtpPayload | null`
  - `setOtpSessionCookie(res, token)`
  - `getOtpSessionFromCookies(cookies): OtpPayload | null`

**기존 인증 가드 확장:**
- `src/lib/auth.ts`의 `getDonorSession()` 수정:
  1. 기존 Supabase Auth 세션 확인 → 있으면 memberId 반환 (기존 로직)
  2. 없으면 → `donor-otp-session` 쿠키에서 JWT 확인 → 유효하면 memberId 반환
  3. 둘 다 없으면 → null 반환

**변경 파일:**
- `supabase/migrations/YYYYMMDD_otp_codes.sql` (신규)
- `src/lib/sms/nhn-client.ts` (신규)
- `src/lib/auth/otp-session.ts` (신규)
- `src/app/api/auth/otp/send/route.ts` (신규)
- `src/app/api/auth/otp/verify/route.ts` (신규)
- `src/lib/auth.ts` (수정 — getDonorSession 확장)

---

### 섹션 2 — 토스 본인인증 연동

**사용 시점:**
- 위저드 Step2에서 "기부금 영수증 신청" 체크 시에만 본인인증 진행
- 이미 인증 완료된 회원(`identity_verified_at` 존재)은 재인증 불필요

**DB 변경:**
- `members` 테이블에 컬럼 추가:
  - `ci_hash TEXT` — 본인인증 CI 해시값 (nullable)
  - `identity_verified_at TIMESTAMPTZ` — 본인인증 완료 시각 (nullable)
- 마이그레이션 파일: `supabase/migrations/YYYYMMDD_members_identity.sql`

**토스 본인인증 플로우:**
1. 프론트: "본인인증" 버튼 클릭
2. `POST /api/auth/identity/request` → 토스 본인인증 요청 생성 → `{ txId, authUrl }` 반환
3. 프론트: 토스 본인인증 팝업 오픈 (`authUrl`)
4. 인증 완료 후 콜백 → `POST /api/auth/identity/confirm` with `{ txId }`
5. 서버: 토스 API로 인증 결과 조회 → `name`, `birthday`, `ci` 추출
6. `members` 테이블 업데이트: `ci_hash`, `identity_verified_at`, 이름/생년월일 갱신

**API:**

`POST /api/auth/identity/request`
- 토스 본인인증 API 호출 (`POST /v1/identity-verification/requests`)
- 필요 파라미터: `requestedAt`, `successUrl`, `failUrl`
- 응답: `{ txId: string }`
- successUrl: `/donate/wizard?identity=success&txId={txId}`
- failUrl: `/donate/wizard?identity=fail`

`POST /api/auth/identity/confirm`
- Body: `{ txId: string, memberId?: string }`
- 토스 API 호출 (`GET /v1/identity-verification/requests/{txId}`)
- 응답에서 `personalInfo.name`, `personalInfo.birthday`, `personalInfo.ci` 추출
- members 업데이트 → `{ ok: true, name, birthday }`

**위저드 Step2 변경:**
- 영수증 체크 시:
  - `identity_verified_at` 있으면 → "인증 완료 ✓" 뱃지 표시
  - 없으면 → "본인인증" 버튼 표시
- 본인인증 성공 시 → 이름/생년월일 필드 자동 채움, 주민번호 입력란 제거
- 본인인증 취소/실패 → 영수증 미신청으로 복귀, 후원은 계속 가능

**환경변수:**
- `TOSS_IDENTITY_SECRET_KEY` (본인인증 전용 시크릿 — 결제 키와 별도)

**변경 파일:**
- `supabase/migrations/YYYYMMDD_members_identity.sql` (신규)
- `src/app/api/auth/identity/request/route.ts` (신규)
- `src/app/api/auth/identity/confirm/route.ts` (신규)
- `src/app/donate/wizard/steps/Step2.tsx` (수정 — 본인인증 UI 추가, 주민번호 입력 제거)

---

### 섹션 3 — 통합 마이페이지 확장

**로그인 화면 변경 (`/donor/login`):**
- 기존 이메일/비밀번호 폼 상단 유지
- 구분선: `"또는"` 텍스트 + `<hr>`
- 하단: "휴대폰 번호로 간편 로그인" 섹션
  - 전화번호 입력 → "인증번호 발송" 버튼
  - 인증번호 입력 → "로그인" 버튼
  - 상태: 발송 중 / 발송 완료 / 인증 실패 / 후원 내역 없음
- 컴포넌트: `src/components/donor/otp-login-form.tsx` (신규)

**마이페이지 기능 범위:**

| 기능 | 회원(Supabase Auth) | 비회원(OTP 세션) |
|------|:---:|:---:|
| 후원 내역(결제 이력) 조회 | ✅ | ✅ |
| 기부금 영수증 조회/다운로드 | ✅ | ✅ |
| 개인정보 수정(이름, 연락처) | ✅ | ✅ |
| 일시후원 취소 요청 | ✅ | ✅ |
| 정기후원 해지 요청 | ✅ | ✅ |
| 비밀번호 변경 | ✅ | 숨김 |
| 이메일 변경 | ✅ | 숨김 |

**후원 취소/해지 API:**

`POST /api/donor/payments/[id]/cancel`
- 인증: getDonorSession (회원 or OTP)
- 검증: 해당 payment가 세션의 memberId 소유인지 확인
- 조건: `pay_status === 'paid'` AND 결제 후 7일 이내
- 로직: 토스 결제 취소 API (`POST /v1/payments/{paymentKey}/cancel`) 호출
- 성공 시: `pay_status` → `cancelled`, `cancelled_at` 기록
- 실패 시: 에러 메시지 반환

`PATCH /api/donor/pledges/[id]/cancel`
- 인증: getDonorSession
- 검증: 해당 pledge가 세션의 memberId 소유인지 확인
- 로직: pledge `status` → `cancelled` 업데이트
- 다음 회차부터 미청구

**마이페이지 UI 변경:**
- 기존 `/donor` 대시보드에 "후원 취소" / "해지" 버튼 추가
- 결제 내역 각 행에: 취소 가능하면 "취소" 버튼 (7일 이내만)
- 약정 목록 각 행에: 활성 약정이면 "해지" 버튼
- 확인 모달: "정말 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다."
- 비회원 세션: 비밀번호/이메일 변경 섹션 숨김 처리

**변경 파일:**
- `src/components/donor/otp-login-form.tsx` (신규)
- `src/app/(donor)/donor/login/page.tsx` (수정 — OTP 로그인 섹션 추가)
- `src/app/api/donor/payments/[id]/cancel/route.ts` (신규)
- `src/app/api/donor/pledges/[id]/cancel/route.ts` (신규)
- `src/app/(donor)/donor/page.tsx` (수정 — 취소/해지 버튼, 비회원 분기)
- `src/app/(donor)/donor/payments/page.tsx` (수정 — 취소 버튼)
- `src/components/donor/cancel-confirm-modal.tsx` (신규)

---

## 3. 변경하지 않는 것

- 관리자 인증 체계 (admin login, RLS, requireAdminUser)
- 기존 위저드/레거시 폼의 결제 API 로직 (`/api/donations/prepare`, 웹훅, confirm)
- 캠페인 빌더, 블록 렌더러
- Sub-1 테마 시스템, 공유 컴포넌트
- DB 스키마 (otp_codes 신규, members에 2컬럼 추가 외)
- 라우팅 구조 (기존 `/donor/*` 경로 유지)

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| OTP 전화번호로 members 매칭 0건 | "후원 내역이 없습니다" 안내, 세션 미발급 |
| 동일 org 내 동일 phone 2건+ | DB unique 제약 (org_id, phone)으로 방지 |
| 다른 org에서 같은 phone | tenant 컨텍스트로 자동 구분 |
| OTP 1분 내 재발송 요청 | 429 "잠시 후 다시 시도해 주세요" |
| OTP 5회 연속 검증 실패 | 30분 잠금, "잠시 후 다시 시도해 주세요" |
| 본인인증 팝업 중단(사용자 취소) | 영수증 미신청으로 복귀, 후원 계속 가능 |
| 이미 본인인증 완료된 회원이 다시 인증 | ci_hash / identity_verified_at 갱신 |
| 취소 요청 시 결제 후 7일 초과 | "취소 가능 기간이 지났습니다. 관리자에게 문의해 주세요." |
| 정기후원 해지 후 재가입 | 새 pledge 생성 (기존 cancelled 유지) |
| OTP 세션 24시간 만료 | 자동 로그아웃, 재인증 안내 |
| NHN Cloud SMS 장애 | "SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요." |
| 토스 본인인증 API 장애 | "본인인증 서비스에 일시적인 문제가 있습니다." + 영수증 없이 후원 가능 |

---

## 5. 범위 밖 (다음 Sub-project)

- Sub-3: 정기후원 CMS (Toss Billing, 자동결제)
- Sub-4: 기부금 영수증 자동발급 + 감사 이메일/알림톡
