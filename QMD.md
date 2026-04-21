# QMD — Quick Module Documentation

> NPO_S · Next.js 16 App Router + Supabase + Toss Payments  
> 마지막 갱신: 2026-04-21

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [디렉터리 구조](#2-디렉터리-구조)
3. [멀티테넌시 아키텍처](#3-멀티테넌시-아키텍처)
4. [인증 계층](#4-인증-계층)
5. [API 라우트 맵](#5-api-라우트-맵)
6. [핵심 라이브러리 모듈](#6-핵심-라이브러리-모듈)
7. [빌링 서브시스템](#7-빌링-서브시스템)
8. [알림 서브시스템](#8-알림-서브시스템)
9. [영수증 서브시스템](#9-영수증-서브시스템)
10. [빌더 서브시스템](#10-빌더-서브시스템)
11. [데이터 흐름 시나리오](#11-데이터-흐름-시나리오)
12. [데이터베이스 스키마 요약](#12-데이터베이스-스키마-요약)
13. [보안 패턴](#13-보안-패턴)
14. [외부 서비스 연동](#14-외부-서비스-연동)
15. [환경변수 레퍼런스](#15-환경변수-레퍼런스)
16. [Known Limitations & TODO](#16-known-limitations--todo)

---

## 1. 프로젝트 개요

비영리단체(NPO)를 위한 **SaaS 기반 후원 관리 플랫폼**.  
각 기관(테넌트)이 자체 서브도메인(`org.domain.com`)을 가지며, 캠페인 빌더 · 후원 결제 · 정기빌링 · 기부금 영수증 · ERP 연동을 제공한다.

| 항목 | 값 |
| --- | --- |
| Framework | Next.js 16.2.3 (App Router) |
| UI | React 19.2.4 + TailwindCSS + shadcn/ui |
| Backend | Supabase PostgreSQL (Project ID: `gwahitthhnucgxqwgjlq`) |
| Auth | Supabase Auth (JWT) + OTP (jose) |
| 결제 PG | Toss Payments (일시 + 정기빌링) |
| 이메일 | Resend API |
| 알림 | NHN Cloud 알림톡 + SMS fallback |
| PDF | pdfmake (서버사이드, NotoSansKR 폰트) |
| 암호화 | pgcrypto (`extensions` 스키마) |
| HTML Sanitize | isomorphic-dompurify |
| 배포 | Vercel |

---

## 2. 디렉터리 구조

```text
src/
├── app/
│   ├── (admin)/          # 관리자 대시보드 (requireAdminUser)
│   │   └── admin/
│   │       ├── page.tsx              — 대시보드 (인사이트 카드 + 차트)
│   │       ├── campaigns/            — 캠페인 관리 + 빌더
│   │       ├── members/              — 후원자 관리 + 상담 기록
│   │       ├── payments/             — 결제 내역 + 오프라인 등록
│   │       ├── promises/             — 정기 후원 약정
│   │       ├── receipts/             — 기부금 영수증 + NTS 전산매체
│   │       ├── email-templates/      — 이메일 템플릿 에디터 (Tiptap)
│   │       ├── landing/              — 기관 랜딩페이지 빌더
│   │       ├── settings/             — Toss / ERP / 테마 설정
│   │       ├── audit-logs/           — 감사 로그 뷰어
│   │       ├── notifications/        — 알림 센터
│   │       ├── schedules/            — 자동화 스케줄 현황
│   │       ├── stats/                — 통계 대시보드
│   │       ├── unpaid/               — 미납 관리
│   │       └── users/                — 관리자 계정 관리
│   │
│   ├── (admin-auth)/     # 관리자 로그인 페이지
│   ├── (donor)/          # 후원자 마이페이지 (requireDonorSession)
│   │   └── donor/
│   │       ├── page.tsx              — 마이페이지 홈
│   │       ├── login/                — OTP 로그인
│   │       ├── signup/               — 회원가입
│   │       ├── payments/             — 내 결제 내역
│   │       ├── promises/             — 내 정기 약정
│   │       └── receipts/             — 내 영수증 (PDF 다운로드)
│   │
│   ├── (public)/         # 공개 페이지 (인증 없음)
│   │   ├── page.tsx                  — 기관 랜딩페이지 (published_content ISR)
│   │   ├── campaigns/[slug]/         — 캠페인 페이지 + 기부 폼
│   │   └── donate/success|fail/      — Toss 결제 결과
│   │
│   └── api/              # API 라우트 (→ 섹션 5)
│
├── lib/                  # 비즈니스 로직 (→ 섹션 6-10)
│   ├── auth/             — 인증 가드 3종
│   ├── billing/          — 정기빌링 서비스 (→ 섹션 7)
│   ├── campaign-builder/ — 빌더 스키마 + 게시 + 미리보기 토큰
│   ├── donations/        — 결제 승인/취소
│   ├── email/            — 템플릿 시스템 + Resend 발송
│   ├── erp/              — ERP webhook push
│   ├── notifications/    — 알림톡/SMS fallback (→ 섹션 8)
│   ├── receipt/          — PDF 생성 + 연간 일괄 발급 (→ 섹션 9)
│   ├── secrets/          — pgcrypto 래퍼
│   ├── sms/              — NHN Cloud SMS 클라이언트
│   ├── stats/            — 인사이트 엔진
│   ├── supabase/         — 4종 Supabase 클라이언트
│   ├── tenant/           — 테넌트 resolver + context
│   ├── theme/            — ThemeConfig 스키마 + CSS 변수 생성
│   └── toss/             — Toss API 클라이언트 + 키 관리
│
├── components/
│   ├── admin/            — 관리자 UI (차트 5종 포함)
│   ├── campaign-blocks/  — 캠페인 렌더 블록 8종
│   ├── campaign-builder/ — 빌더 에디터 (Canvas/Palette/PropsPanel)
│   ├── donor/            — 후원자 마이페이지 컴포넌트
│   ├── landing-builder/  — 랜딩 섹션 에디터 + 렌더러
│   ├── public/           — 기부 폼 (스텝 구성)
│   └── ui/               — shadcn/ui 기반 공통 컴포넌트
│
└── proxy.ts              # Next.js 16 Middleware (구 middleware.ts)

```

---

## 3. 멀티테넌시 아키텍처

### 테넌트 해석 흐름

```text
요청 Host 헤더 (e.g. npo1.supporters.kr)
    ↓
proxy.ts  ─  extractSlugFromHost(host)  [순수함수, DB 없음]
    ↓
resolveTenant(slug)  →  orgs WHERE slug=? AND status='active'
    ↓  x-tenant-id / x-tenant-slug 헤더 주입
Server Component / API Route
    ↓
getTenant()  →  Tenant { id, slug, name, status }
    ↓
org_id로 RLS 격리된 모든 Supabase 쿼리

```

### 핵심 파일

| 파일 | 역할 |
| --- | --- |
| `src/proxy.ts` | Next.js 16 Middleware — 헤더 주입, webhook matcher 제외 |
| `src/lib/tenant/resolver.ts` | `extractSlugFromHost()` (순수) + `resolveTenant()` (DB) |
| `src/lib/tenant/context.ts` | `getTenant()` / `requireTenant()` — Server Component에서 호출 |
| `src/lib/tenant/types.ts` | `Tenant` 타입 정의 |

### 예약 slug

`www`, `platform`, `api`, `admin` — 서브도메인으로 사용 불가.

### 로컬 개발

- `{slug}.localhost:3000` 형태로 접근 가능
- 서브도메인 없이 `localhost:3000` 접근 시: `DEV_TENANT_SLUG` 환경변수로 fallback

### Tenant 상태

| status | 의미 |
| --- | --- |
| `active` | 정상 서비스 |
| `trial` | 체험 중 (resolver가 허용) |
| `suspended` | 접근 차단 (resolver가 null 반환) |

---

## 4. 인증 계층

### 역할 구분

| 역할 | 판별 조건 | 세션 방식 |
| --- | --- | --- |
| 관리자 | `user_metadata.role === 'admin'` | Supabase Auth JWT (쿠키) |
| 후원자 | OTP 인증 → `donor-otp-session` 쿠키 | jose HS256 JWT (24h) |
| 공개 | 없음 | — |

### 인증 가드 함수 (완전 목록)

| 함수 | 파일 | 용도 | 실패 동작 |
| --- | --- | --- | --- |
| `requireAdminUser()` | `lib/auth.ts` | 관리자 페이지용 | redirect `/admin/login` |
| `requireDonorSession()` | `lib/auth.ts` | 후원자 페이지용 | redirect `/donor/login` |
| `getAdminUser()` | `lib/auth.ts` | null-safe 조회 | null 반환 |
| `requireAdminApi()` | `lib/auth/api-guard.ts` | **API 라우트 전용** | JSON 401/403/400 |
| `requireAdminOrgForBuilder()` | `lib/auth/builder-guard.ts` | 빌더 라우트 전용 | JSON 401/403 |
| `getOtpSessionFromCookies()` | `lib/auth/otp-session.ts` | 후원자 OTP 세션 읽기 | null 반환 |
| `signOtpToken()` | `lib/auth/otp-session.ts` | OTP 토큰 발급 | — |
| `verifyOtpToken()` | `lib/auth/otp-session.ts` | OTP 토큰 검증 | null 반환 |

> **API 라우트에서는 반드시 `requireAdminApi()`를 사용한다.**  
> 페이지용 `requireAdminUser()`는 실패 시 307 redirect를 반환하고, fetch 클라이언트는 이를 HTML로 수신해 JSON 파싱 오류를 일으킨다.

### OTP 세션 흐름

```text
POST /api/auth/otp/send   → Supabase Auth OTP 발송
POST /api/auth/otp/verify → 검증 후 signOtpToken() → Set-Cookie: donor-otp-session
POST /api/donor/link      → getOtpSessionFromCookies() → members 테이블 연결

```

---

## 5. API 라우트 맵

### `/api/admin/*` — 관리자 전용

모든 라우트: `requireAdminApi()` → `ctx.tenant.id` 로 `org_id` 격리

| 경로 | 메서드 | 기능 |
| --- | --- | --- |
| `/admin/campaigns` | GET, POST | 캠페인 목록/생성 |
| `/admin/campaigns/[id]` | GET, PATCH, DELETE | 캠페인 단건 |
| `/admin/campaigns/[id]/assets` | GET, POST | 캠페인 이미지 에셋 |
| `/admin/campaigns/[id]/assets/[assetId]` | DELETE | 에셋 삭제 |
| `/admin/campaigns/[id]/form-settings` | GET, PATCH | 기부 폼 설정 (FormSettings 스키마) |
| `/admin/campaigns/[id]/page-content` | GET, PATCH | 빌더 콘텐츠 (PageContent 스키마) |
| `/admin/campaigns/[id]/preview-token` | POST | 미리보기 토큰 발급 |
| `/admin/campaigns/[id]/publish` | POST | 게시 → `published_content` + ISR revalidate |
| `/admin/members` | GET, POST | 후원자 목록/생성 |
| `/admin/members/import` | POST | CSV 일괄 가져오기 |
| `/admin/members/[id]` | GET, PATCH, DELETE | 후원자 단건 |
| `/admin/members/[id]/consultations` | GET, POST | 상담 기록 |
| `/admin/payments` | GET, POST | 결제 목록/오프라인 등록 |
| `/admin/payments/[id]` | GET, PATCH, DELETE | 결제 단건 |
| `/admin/payments/income-status` | GET | 수입 현황 집계 |
| `/admin/promises` | GET, POST | 정기 약정 목록/생성 |
| `/admin/promises/[id]` | GET, PATCH, DELETE | 약정 단건 |
| `/admin/receipts/[memberId]` | GET, POST | 회원별 영수증 (수동 발급 포함) |
| `/admin/receipts/[memberId]/rrn` | GET | RRN 복호화 조회 (audit log 기록) |
| `/admin/receipts/nts-export` | GET | NTS 전산매체 EUC-KR 다운로드 |
| `/admin/receipts/nts-export/log` | POST | NTS 내보내기 감사 로그 |
| `/admin/email-templates` | GET, POST, PATCH | 이메일 템플릿 CRUD |
| `/admin/email-templates/preview` | POST | HTML 미리보기 렌더링 |
| `/admin/email-templates/test-send` | POST | 테스트 이메일 발송 |
| `/admin/notifications` | GET | 알림 목록 |
| `/admin/notifications/[id]/read` | POST | 읽음 처리 |
| `/admin/notifications/unread-count` | GET | 미읽음 카운트 |
| `/admin/org` | GET, PATCH | 기관 정보 |
| `/admin/org/landing` | GET, PATCH | 랜딩 빌더 콘텐츠 |
| `/admin/org/landing/images` | POST | 랜딩 이미지 업로드 → campaign-assets 버킷 |
| `/admin/org/landing/publish` | POST | 랜딩 게시 → `published_content` |
| `/admin/settings/toss` | GET, PATCH | Toss 키 설정 (암호화 저장) |
| `/admin/settings/erp` | GET, PATCH | ERP 키 설정 (암호화 저장) |
| `/admin/settings/theme` | GET, PATCH | 테마 설정 (ThemeConfig 스키마) |
| `/admin/users` | GET, PATCH, DELETE | 관리자 계정 |
| `/admin/export/members` | GET | 후원자 CSV 내보내기 |
| `/admin/export/payments` | GET | 결제 CSV 내보내기 |

### `/api/donations/*` — 결제 흐름 (공개, rate-limited)

| 경로 | 메서드 | 기능 |
| --- | --- | --- |
| `/donations/prepare` | POST | Toss 결제 준비 (orderId 예약) |
| `/donations/confirm` | POST | Toss 결제 승인 + payments INSERT |

### `/api/donor/*` — 후원자 인증 필요 (OTP 세션)

| 경로 | 메서드 | 기능 |
| --- | --- | --- |
| `/donor/profile` | GET, PATCH | 내 프로필 |
| `/donor/link` | POST | 후원자 계정 연결 (OTP 인증 후) |
| `/donor/payments/[id]/cancel` | POST | 결제 취소 |
| `/donor/promises` | GET, POST | 정기 약정 목록/등록 |
| `/donor/promises/[id]` | GET, PATCH | 약정 단건 |
| `/donor/pledges/[id]/cancel` | POST | 약정 해지 |
| `/donor/receipts` | GET | 내 영수증 목록 |

### `/api/auth/*` — 인증

| 경로 | 메서드 | 기능 |
| --- | --- | --- |
| `/auth/otp/send` | POST | Supabase Auth OTP 발송 |
| `/auth/otp/verify` | POST | OTP 검증 + donor-otp-session 쿠키 발급 |
| `/auth/identity/request` | POST | 본인확인 요청 |
| `/auth/identity/confirm` | POST | 본인확인 완료 |

### `/api/cron/*` — 자동화 (Bearer CRON_SECRET)

| 경로 | 주기 | 기능 |
| --- | --- | --- |
| `/cron/process-payments` | 매월 1일 | 정기 결제 처리 → `processMonthlyCharges()` |
| `/cron/retry-billing` | 매일 | 실패 결제 재시도 → `processRetries()` |
| `/cron/billing-reminder` | 매월 말 | D-3 결제 예정 알림 |
| `/cron/issue-annual-receipts` | 1월 | 연간 기부금 영수증 일괄 발급 |
| `/cron/purge-expired-rrn` | 매일 | 만료 RRN 삭제 |

### `/api/webhooks/*` — 외부 콜백

| 경로 | 기능 |
| --- | --- |
| `/webhooks/toss` | Toss Payments 웹훅 — HMAC `timingSafeEqual` 검증 후 결제 상태 업데이트 |

> `proxy.ts` matcher에서 `/api/webhooks` 경로는 미들웨어 적용 제외.

### `/api/v1/*` — ERP 외부 연동 (x-api-key SHA-256)

| 경로 | 메서드 | 기능 |
| --- | --- | --- |
| `/v1/payments` | GET | 결제 목록 조회 |
| `/v1/payments/[id]/status` | GET | 결제 상태 단건 조회 |

### `/api/public/*` — 공개 (rate-limited)

| 경로 | 기능 |
| --- | --- |
| `/public/campaigns/[slug]/progress` | 캠페인 모금 진행 현황 (ISR 캐시) |

---

## 6. 핵심 라이브러리 모듈

### `src/lib/tenant/`

```ts
// resolver.ts
extractSlugFromHost(host: string): string | null    // 순수함수 — DB 없음
resolveTenant(host: string): Promise<Tenant | null> // middleware에서 호출

// context.ts
getTenant(): Promise<Tenant | null>    // x-tenant-id 헤더 → orgs 조회
requireTenant(): Promise<Tenant>       // 없으면 throw (error boundary 폴백)

```

### `src/lib/auth.ts`

```ts
requireAdminUser(): Promise<User>                    // 페이지용, 실패 → redirect
requireDonorSession(): Promise<OtpPayload>           // 후원자 페이지용
getAdminUser(): Promise<User | null>

```

### `src/lib/auth/api-guard.ts`

```ts
requireAdminApi(): Promise<{ ok: true; ctx: ApiAdminContext } | { ok: false; response: NextResponse }>
// API 라우트 표준 패턴 — JSON 401(미인증) / 403(권한없음) / 400(테넌트없음)

```

### `src/lib/auth/otp-session.ts`

```ts
signOtpToken(payload: OtpPayload): Promise<string>          // jose HS256, 24h
verifyOtpToken(token: string): Promise<OtpPayload | null>
getOtpSessionFromCookies(): Promise<OtpPayload | null>
otpSessionCookieConfig(token): CookieConfig                 // httpOnly, secure, sameSite=lax

```

키: `OTP_JWT_SECRET` 환경변수 (없으면 throw)

### `src/lib/supabase/`

| 파일 | 함수 | 사용처 |
| --- | --- | --- |
| `server.ts` | `createSupabaseServerClient()` | Server Component, 쿠키 기반 세션 |
| `admin.ts` | `createSupabaseAdminClient()` | **서버 전용** Service Role, RLS 우회 |
| `client.ts` | `createSupabaseBrowserClient()` | Client Component |
| `request-client.ts` | `createSupabaseRequestClient()` | API Route |

> `admin.ts`는 절대 클라이언트 번들에 포함시키지 않는다. service_role 키 노출 방지.

### `src/lib/secrets/crypto.ts`

```ts
encryptSecret(plaintext: string): Promise<string>   // pgp_sym_encrypt (extensions 스키마)
decryptSecret(ciphertext: string): Promise<string>  // pgp_sym_decrypt
hashApiKey(key: string): string                     // SHA-256 hex (ERP API key 검증용)

```

암호화 키 우선순위: `ORG_SECRETS_KEY` → `RECEIPTS_ENCRYPTION_KEY`

### `src/lib/donations/confirm.ts`

```ts
confirmDonation(paymentKey, orderId, amount): Promise<Payment>
cancelDonation(paymentKey, reason): Promise<void>

```

- race condition 방지: `.neq("pay_status", "paid")` 조건으로 중복 승인 차단
- 승인 후 `revalidateTag(`campaign:{slug}`)` 호출

### `src/lib/toss/`

```ts
// keys.ts
getOrgTossKeys(orgId: string): Promise<{ tossClientKey, tossSecretKey }>
// org_secrets.*_enc 컬럼에서 복호화

// client.ts
confirmTossPayment(secretKey, paymentKey, orderId, amount)
cancelTossPayment(secretKey, paymentKey, reason)

// config.ts
TOSS_BASE_URL = 'https://api.tosspayments.com/v1'

```

### `src/lib/email/`

```ts
// resolve-template.ts
resolveTemplate(orgId, scenario): Promise<{ subject, html }>
// 우선순위: email_templates (DB 커스텀) → default-templates.ts (내장)

// template-renderer.ts
renderTemplate(html, variables): string  // Handlebars 변수 치환

// send-email.ts
sendEmail({ to, subject, html }): Promise<void>  // Resend API 래퍼

```

이메일 시나리오: `donation_confirmed`, `receipt_issued`, `billing_failed`, `billing_upcoming`, `otp`, `invite`

### `src/lib/audit.ts`

```ts
logAudit(action: string, metadata: object): Promise<void>
// audit_logs 테이블 INSERT (service_role만 가능, RLS로 UPDATE/DELETE 차단)

```

### `src/lib/rate-limit.ts`

```ts
rateLimit(key: string, limit: number, windowMs: number): Promise<boolean>
getClientIp(request: NextRequest): string

```

> **주의**: in-memory Map 구현. Vercel 멀티 인스턴스에서 격리되어 실효성 감소.  
> 프로덕션 권장: Vercel KV(Redis) 기반 교체.

### `src/lib/erp/webhook.ts`

```ts
pushErpWebhook(orgId: string, payload: ErpPayload): Promise<void>
// org_secrets에서 ERP URL + API Key 복호화 후 POST

```

### `src/lib/codes.ts`

```ts
generateMemberCode(year, seq): string    // M-{YYYY}{00000}
generatePromiseCode(year, seq): string   // P-{YYYY}{00000}
generatePaymentCode(year, seq): string   // PMT-{YYYY}{00000}
generateReceiptCode(year, seq): string   // RCP-{YYYY}-{00000}
// 모두 순수함수. seq 범위: 1-99999

```

### `src/lib/format.ts`

```ts
formatKRW(amount: number): string         // "1,000원"
formatDateKR(iso: string | null): string  // "2026.04.21"

```

### `src/lib/sanitize.ts` / `src/lib/campaign-builder/sanitize-html.ts`

```ts
// lib/sanitize.ts (전역 범용)
sanitizeHtml(dirty: string): string      // DOMPurify — 모든 XSS 제거
stripHtml(dirty: string): string         // 태그 전체 제거, 텍스트만 반환

// lib/campaign-builder/sanitize-html.ts (빌더용, 허용 태그 제한적)
sanitizeHtml(html: string): string       // p/br/strong/em/a/img 등 허용

```

### `src/lib/stats/insights.ts`

```ts
computeInsights(input: InsightInput): Insight[]

```

7가지 인사이트 규칙: 미납율 급등 / 이탈 위험 / 신규 감소 / 영수증 미발급(1월) / CMS 처리중 / 최고 캠페인 / 모두 양호  
severity: `danger` | `warning` | `positive` | `info`

### `src/lib/theme/config.ts`

```ts
ThemeConfigSchema     // Zod 스키마
defaultThemeConfig(): ThemeConfig
themeConfigToCss(config: ThemeConfig): string  // → :root { --accent: ...; } 문자열
// 공개 layout에 <style> 태그로 주입

```

CSS 변수: `--accent`, `--accent-soft`, `--bg`, `--surface`, `--surface-2`, `--text`, `--muted-foreground`, `--border`

---

## 7. 빌링 서브시스템

정기 후원 약정의 자동 결제 처리. `src/lib/billing/`

### 빌링 파일 구조

| 파일 | 역할 |
| --- | --- |
| `toss-billing.ts` | Toss Billing API 클라이언트 (`issueBillingKey`, `chargeBillingKey`) |
| `charge-service.ts` | 월초 정기 결제 처리 (`processMonthlyCharges`) |
| `retry-service.ts` | 실패 결제 재시도 (`processRetries`) |
| `notifications.ts` | 결제 실패/약정 정지 알림 생성 (`createBillingFailedNotification`, `createPledgeSuspendedNotification`) |

### 월초 결제 흐름 (`processMonthlyCharges`)

```text
payments WHERE pay_status='pending' AND pay_date<=today AND toss_payment_key IS NULL
    ↓
promises.toss_billing_key + customer_key 조회
    ↓
chargeBillingKey() → Toss API POST /billing/{billingKey}
    ↓ 성공                      ↓ 실패
payments.pay_status='paid'   payments.pay_status='failed'
                              retry_count=0, next_retry_at=+1일
                              createBillingFailedNotification()

```

### 재시도 흐름 (`processRetries`)

재시도 스케줄: retry_count 0 → +1일, 1 → +3일, 2 → +7일  
3회 실패 → `promises.status='suspended'` + `createPledgeSuspendedNotification()`

### 빌링키 발급 (`issueBillingKey`)

CMS(자동이체) 방식: `POST /billing/authorizations/card` (카드 정보 → billingKey 발급)

---

## 8. 알림 서브시스템

후원자 대상 알림: **카카오 알림톡 우선, 실패 시 SMS fallback**. `src/lib/notifications/`

### 알림 파일 구조

| 파일 | 역할 |
| --- | --- |
| `alimtalk-client.ts` | NHN Cloud 알림톡 API (`sendAlimtalk`) |
| `send.ts` | 시나리오별 발송 함수 (알림톡+SMS+이메일 통합) |
| `templates.ts` | SMS fallback 문자 템플릿 |
| `src/lib/sms/nhn-client.ts` | NHN Cloud SMS API (`sendSms`) |

### Fallback 패턴

```ts
async function sendWithFallback(phone, templateCode, params, smsBody) {
  const result = await sendAlimtalk(phone, templateCode, params)
  if (!result.success) {
    await sendSms(phone, smsBody)   // 알림톡 실패 시 SMS로 대체
  }
}

```

> 알림톡/SMS 환경변수(`NHN_ALIMTALK_*`, `NHN_SMS_*`)가 미설정이면 **에러 없이 건너뜀** (warn 로그).  
> 발송 실패가 무음으로 처리되므로 프로덕션에서 환경변수 필수 확인.

### 알림 시나리오

| 함수 | 트리거 | 채널 |
| --- | --- | --- |
| `notifyDonationThanks()` | 결제 승인 완료 | 알림톡 + 이메일 |
| `notifyReceiptIssued()` | 영수증 발급 | 알림톡 + 이메일 |
| `notifyBillingFailed()` | 정기 결제 실패 (후원자) | 알림톡 |
| `notifyBillingUpcoming()` | 결제 D-3 예정 | 알림톡 |
| `createBillingFailedNotification()` | 정기 결제 실패 | admin_notifications + 관리자 이메일 + 후원자 알림톡 |
| `createPledgeSuspendedNotification()` | 3회 실패 → 약정 정지 | admin_notifications + 관리자 이메일 |

### 알림톡 템플릿 코드

`DONATION_THANKS`, `RECEIPT_ISSUED`, `BILLING_FAILED`, `BILLING_UPCOMING`  
(KakaoTalk 비즈니스 채널에 사전 등록 필요)

---

## 9. 영수증 서브시스템

기부금 영수증 PDF 생성 및 일괄 발급. `src/lib/receipt/`

### 영수증 파일 구조

| 파일 | 역할 |
| --- | --- |
| `pdf.ts` | pdfmake 서버사이드 PDF 생성 (`generateReceiptPdf`) |
| `annual-batch.ts` | 연간 일괄 발급 배치 (`issueAnnualReceipts`) |

### PDF 생성 (`generateReceiptPdf`)

- 엔진: pdfmake 0.3.x (서버사이드 싱글톤)
- 한글 폰트: `public/fonts/NotoSansKR-Regular.ttf`, `NotoSansKR-Bold.ttf` 필요 (없으면 명확한 에러)
- URL 접근 차단: `setUrlAccessPolicy(false)` — 외부 리소스 fetch 방지

### 연간 일괄 발급 흐름 (`issueAnnualReceipts`)

```text
payments WHERE pay_status='paid' AND receipt_opt_in=true AND year=N
    ↓  member_id 기준 집계 (total, payments[])
    ↓  기발급 receipts 체크 → 중복 skip
    ↓  generateReceiptPdf()
    ↓  Supabase Storage `receipts` 버킷에 업로드
    ↓    └─ {orgId}/{year}/{receiptCode}.pdf
    ↓  createSignedUrl(365일)
    ↓  receipts INSERT
    ↓  notifyReceiptIssued() (fire-and-forget)
결과: { issued, skipped, failed }

```

### 영수증 코드 형식

`RCP-{YYYY}-{00001}` — `generateReceiptCode(year, seq)` 생성

---

## 10. 빌더 서브시스템

캠페인 페이지 빌더와 기관 랜딩페이지 빌더. `src/lib/campaign-builder/`

### 캠페인 빌더 블록 타입 (8종)

| 블록 | 컴포넌트 | 주요 props |
| --- | --- | --- |
| `hero` | `Hero.tsx` | backgroundImageAssetId, headline, ctaAnchorBlockId |
| `richText` | `RichText.tsx` | html (DOMPurify sanitize) |
| `imageSingle` | `ImageSingle.tsx` | assetId, alt, caption |
| `impactStats` | `ImpactStats.tsx` | items[] (최대 6개) |
| `fundraisingProgress` | `FundraisingProgress.tsx` | showGoal, showDonorCount, showDeadline |
| `faq` | `Faq.tsx` | items[{question, answer}] |
| `donationQuickForm` | `DonationQuickForm.tsx` | 기부 폼 인라인 삽입 |
| `snsShare` | `SnsShare.tsx` | 공유 버튼 |

모든 블록에 공통 필드: `id`, `anchor?`, `hiddenOn?: 'mobile' | 'desktop'`

### FormSettings 스키마

```ts
{
  amountPresets: number[]         // 금액 선택지 (e.g. [10000, 30000, 50000])
  amountDescriptions?: Record<string, string>
  allowCustomAmount: boolean
  donationTypes: ('regular' | 'onetime')[]
  paymentMethods: ('card' | 'cms' | 'naverpay' | 'kakaopay' | 'payco' | 'virtual')[]
  designations: { key, label }[]  // 지정 후원 항목 (중복 key 불가)
  customFields: { key, label, type, required, options? }[]
  requireReceipt: boolean
  termsBodyHtml: string
  marketingOptInLabel?: string
  completeRedirectUrl: string | null
}

```

### 게시 흐름

```text
빌더 저장 (page_content JSONB)
    ↓  POST /admin/campaigns/[id]/publish
    ↓  PageContentSchema.safeParse() 검증
    ↓  campaigns.published_content = page_content
    ↓  revalidateTag(`campaign:{slug}`)  ← ISR 캐시 무효화
공개 페이지가 published_content를 렌더링

```

### 미리보기 토큰

```ts
generatePreviewToken(): string          // randomBytes(16).toString('base64url')
verifyPreviewToken(stored, provided)    // timingSafeEqual (timing attack 방지)

```

`/?draft=1` + 관리자 세션: page_content(초안) 렌더링  
일반 접근: published_content(게시본) 렌더링

### 랜딩 빌더 섹션 타입 (8종)

`hero`, `stats`, `impact`, `campaigns`, `donationTiers`, `richtext`, `team`, `cta`  
기본값: `src/lib/landing-defaults.ts`의 `getDefaultSectionData(type)`

---

## 11. 데이터 흐름 시나리오

### 일시 후원 결제

```text
후원자 → 기부 폼 작성
    → POST /donations/prepare  : orderId 생성, payments INSERT (pending)
    → Toss 결제창 (클라이언트)
    → POST /donations/confirm  : confirmTossPayment() → payments 업데이트 (paid)
                                → revalidateTag, notifyDonationThanks(), pushErpWebhook()
    → /donate/success 리다이렉트

```

### 정기 후원 약정

```text
후원자 → CMS 약정 폼
    → promises INSERT (active) + toss_billing_key 저장
    → Cron /cron/process-payments  : processMonthlyCharges()
    → 실패 시 /cron/retry-billing  : processRetries() (최대 3회)
    → 3회 실패 → promises.status='suspended'

```

### 기부금 영수증

```text
Cron /cron/issue-annual-receipts (1월)
    → issueAnnualReceipts(orgId, year)
    → payments 집계 → PDF 생성 → Storage 업로드
    → receipts INSERT → notifyReceiptIssued()
또는 관리자 수동 발급:
    POST /admin/receipts/[memberId]

```

### ERP 흐름

```text
외부 ERP → GET /v1/payments?... (x-api-key)
               → hash_api_key(key) == org_secrets.erp_api_key_hash 검증
          또는 payments 이벤트 발생 시
               → pushErpWebhook() (fire-and-forget)

```

---

## 12. 데이터베이스 스키마 요약

| 테이블 | 핵심 컬럼 | 설명 |
| --- | --- | --- |
| `orgs` | `id, slug, name, status, page_content, published_content, theme_config, bank_*, contact_*` | 테넌트(기관) |
| `campaigns` | `id, org_id, slug, title, goal_amount, page_content, published_content, builder_blocks, form_settings` | 후원 캠페인 |
| `members` | `id, org_id, code, name, email, phone, birth_date, id_number_encrypted` | 후원자 |
| `payments` | `id, org_id, member_id, campaign_id, code, amount, pay_status, pay_method, pay_date, toss_payment_key, receipt_opt_in, retry_count, next_retry_at` | 결제 내역 |
| `promises` | `id, org_id, member_id, campaign_id, code, monthly_amount, status, toss_billing_key, customer_key` | 정기 후원 약정 |
| `receipts` | `id, org_id, member_id, year, receipt_code, total_amount, pdf_url, rrn_pending_encrypted, issued_at, issued_by` | 기부금 영수증 |
| `org_secrets` | `org_id, toss_client_key_enc, toss_secret_key_enc, erp_url_enc, erp_api_key_enc, erp_api_key_hash` | 암호화된 외부 API 키 |
| `email_templates` | `id, org_id, scenario, subject, html_body` | 커스텀 이메일 템플릿 |
| `audit_logs` | `id, org_id, user_id, action, metadata, created_at` | 감사 로그 (append-only) |
| `admin_notifications` | `id, org_id, type, title, body, read, meta` | 관리자 알림 |
| `campaign_assets` | `id, campaign_id, org_id, url, mime_type` | 이미지 에셋 (mime_type CHECK) |

### pay_status 상태 전이

```text
pending → paid        (정상 승인)
pending → failed      (결제 실패)
paid    → cancelled   (취소)
failed  → paid        (재시도 성공)
failed  → failed      (재시도 실패, retry_count++)

```

### promises.status 상태 전이

```text
active → suspended   (3회 결제 실패)
active → cancelled   (후원자/관리자 해지)
suspended → active   (관리자 재활성화)

```

### 암호화 컬럼 목록

| 컬럼 | 테이블 | 암호화 키 |
| --- | --- | --- |
| `id_number_encrypted` | `members` | `RECEIPTS_ENCRYPTION_KEY` |
| `rrn_pending_encrypted` | `receipts` | `RECEIPTS_ENCRYPTION_KEY` |
| `toss_client_key_enc` | `org_secrets` | `ORG_SECRETS_KEY` |
| `toss_secret_key_enc` | `org_secrets` | `ORG_SECRETS_KEY` |
| `erp_url_enc` | `org_secrets` | `ORG_SECRETS_KEY` |
| `erp_api_key_enc` | `org_secrets` | `ORG_SECRETS_KEY` |

모든 암호화: `extensions.pgp_sym_encrypt/pgp_sym_decrypt`  
DB 함수에 `SET search_path = public, extensions` 필수.

### Supabase Storage 버킷

| 버킷 | 접근 | 용도 |
| --- | --- | --- |
| `campaign-assets` | 공개 읽기, 관리자 쓰기 | 캠페인/랜딩 이미지 |
| `receipts` | Private (Signed URL) | 기부금 영수증 PDF |

---

## 13. 보안 패턴

### API 라우트 표준 패턴

```ts
export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response   // JSON 401/403/400
  const { ctx: { tenant, user } } = guard

  const supabase = createSupabaseRequestClient()
  const { data } = await supabase
    .from('table')
    .select('*')
    .eq('org_id', tenant.id)  // org_id 격리 필수
}

```

### Toss 웹훅 HMAC 검증

```ts
crypto.timingSafeEqual(
  Buffer.from(expectedSig, 'hex'),
  Buffer.from(receivedSig, 'hex')
)   // timing attack 방지

```

### 결제 승인 race condition 방지

```ts
supabase.from('payments')
  .update({ pay_status: 'paid' })
  .eq('id', paymentId)
  .neq('pay_status', 'paid')   // 중복 승인 차단

```

### ERP API Key 검증 흐름

```text
x-api-key 헤더 수신
    → SHA-256 해시
    → org_secrets.erp_api_key_hash 비교
    (평문 저장 없음, timing-safe compare)

```

### Rate Limit 적용 엔드포인트

- `POST /donations/prepare`
- `POST /donations/confirm`
- `GET /public/campaigns/[slug]/progress`

### HTML Sanitize 레이어

- **API 입력 (빌더)**: `sanitizeHtml()` (campaign-builder용, 허용 태그 제한)
- **일반 HTML**: `sanitizeHtml()` (전역, DOMPurify 기본 설정)
- **텍스트 추출**: `stripHtml()` (태그 전체 제거)

### 미리보기 토큰 검증

`generatePreviewToken()` + `verifyPreviewToken()` — 둘 다 `timingSafeEqual` 사용

---

## 14. 외부 서비스 연동

### Toss Payments

| 기능 | API 경로 | 인증 |
| --- | --- | --- |
| 결제 승인 | `POST /v1/payments/confirm` | Basic (secretKey) |
| 결제 취소 | `POST /v1/payments/{key}/cancel` | Basic |
| 빌링키 발급 | `POST /v1/billing/authorizations/card` | Basic |
| 정기 결제 | `POST /v1/billing/{billingKey}` | Basic |
| 웹훅 수신 | `/api/webhooks/toss` | HMAC-SHA256 |

### Resend

- 발송 함수: `src/lib/email/send-email.ts`
- 환경변수: `RESEND_API_KEY`
- 템플릿 우선순위: DB(`email_templates`) → 내장(`default-templates.ts`)

### NHN Cloud (알림톡 + SMS)

| 서비스 | Base URL | 환경변수 |
| --- | --- | --- |
| 알림톡 | `api-alimtalk.cloud.toast.com/alimtalk/v2.3` | `NHN_ALIMTALK_APP_KEY`, `NHN_ALIMTALK_SECRET_KEY`, `NHN_ALIMTALK_SENDER_KEY` |
| SMS | `api-sms.cloud.toast.com/sms/v3.0` | `NHN_SMS_APP_KEY`, `NHN_SMS_SECRET_KEY`, `NHN_SMS_SENDER` |

미설정 시: 알림톡은 warn 로그 후 skip, SMS는 error 로그 후 skip (예외 미전파).

### ERP 연동

- Push: `pushErpWebhook(orgId, payload)` — fire-and-forget
- Pull: `/api/v1/payments/*` — x-api-key SHA-256 인증
- 키 저장: `org_secrets.erp_url_enc`, `erp_api_key_enc`

### NTS (국세청 전산매체)

- 내보내기: `GET /admin/receipts/nts-export`
- 인코딩: EUC-KR (`iconv-lite`)
- 형식: 고정 길이 텍스트 파일

### pdfmake (영수증 PDF)

- 한글 폰트 파일 경로: `public/fonts/NotoSansKR-{Regular,Bold}.ttf`
- 없으면 `generateReceiptPdf()` 명확한 에러 throw

---

## 15. 환경변수 레퍼런스

### 필수 환경변수 (없으면 런타임 오류)

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (서버 전용) |
| `RECEIPTS_ENCRYPTION_KEY` | RRN / id_number 암호화 기본 키 |
| `CRON_SECRET` | Cron 라우트 Bearer 토큰 |
| `RESEND_API_KEY` | Resend 이메일 발송 키 |
| `OTP_JWT_SECRET` | 후원자 OTP 세션 JWT 서명 키 |

### 선택 환경변수 (없으면 해당 기능 비활성)

| 변수 | 설명 | 없을 때 동작 |
| --- | --- | --- |
| `ORG_SECRETS_KEY` | org_secrets 전용 암호화 키 | `RECEIPTS_ENCRYPTION_KEY`로 폴백 |
| `NHN_ALIMTALK_APP_KEY` | 카카오 알림톡 App Key | 알림톡 발송 skip (warn) |
| `NHN_ALIMTALK_SECRET_KEY` | 알림톡 Secret Key | 위와 동일 |
| `NHN_ALIMTALK_SENDER_KEY` | 알림톡 발신 채널 Key | 위와 동일 |
| `NHN_SMS_APP_KEY` | NHN SMS App Key | SMS 발송 skip (error) |
| `NHN_SMS_SECRET_KEY` | NHN SMS Secret Key | 위와 동일 |
| `NHN_SMS_SENDER` | SMS 발신 번호 | 위와 동일 |
| `DEV_TENANT_SLUG` | localhost 테넌트 오버라이드 | 서브도메인 없으면 테넌트 null |

### 환경변수 배포 전 체크리스트

```text
□ Vercel 환경변수에 필수 7개 등록
□ NHN Cloud 알림톡 템플릿 4종 사전 등록
  (DONATION_THANKS, RECEIPT_ISSUED, BILLING_FAILED, BILLING_UPCOMING)
□ public/fonts/ 에 NotoSansKR-Regular.ttf, NotoSansKR-Bold.ttf 배치
□ org_secrets 재저장: 평문 컬럼 DROP됨 → 각 기관 설정 페이지에서 Toss/ERP 키 재입력

```

---

## 16. Known Limitations & TODO

### 🔴 배포 전 필수

| 항목 | 상태 |
| --- | --- |
| 환경변수 7종 Vercel 등록 | 미완 |
| org_secrets 재저장 (평문 컬럼 DROP됨) | 미완 |
| NotoSansKR 폰트 파일 배치 | 미완 확인 필요 |

### 🟡 알려진 기술적 한계

| 항목 | 설명 | 권장 해결책 |
| --- | --- | --- |
| Rate limiter | In-memory Map — Vercel 멀티 인스턴스에서 인스턴스별 독립 카운터 | Vercel KV (Redis) 교체 |
| 랜딩 빌더 QA | DB + 컴파일만 검증, 섹션 추가·편집·게시·드래그 UI 수동 테스트 미완 | 프로덕션 배포 전 수동 QA |
| NTS 포맷 | 세무서별 포맷 차이 가능성 | 실제 세무서 제출 전 검증 |
| 알림톡 템플릿 | KakaoTalk 비즈니스 채널 사전 등록 없으면 발송 실패 (무음 skip) | 채널 등록 + 테스트 발송 확인 |
| pdfmake 폰트 | `public/fonts/` 폰트 파일 미배치 시 영수증 기능 전체 장애 | CI에 폰트 포함 여부 확인 |

### 🟢 완료된 이슈

- GAP 분석 25건 전체 해결 (높음 7 + 중간 9 + 낮음 9)
- `src/middleware.ts` → `src/proxy.ts` 리네임 (Next.js 16 deprecation 해소)
- 평문 시크릿 컬럼 전체 DROP (migration 011)
- audit_logs RLS — INSERT/UPDATE/DELETE 차단 완료
