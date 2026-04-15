# 후원관리시스템 설계 명세서

> **프로젝트**: NPO 후원관리시스템 (가칭: 서포터즈 플랫폼)
> **작성일**: 2026-04-15
> **범위**: Phase 1 (캠페인·결제·후원자·영수증 기본 기능)
> **서비스 모델**: SaaS — 각 비영리단체가 독립 테넌트로 구독·운영
> **기술스택**: Next.js 15 App Router · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Toss Payments

---

## 목차

1. 용어 정의
2. 서비스 범위 (Phase 1 / Phase 2)
3. SaaS 멀티테넌트 구조
4. 디자인 시스템
5. GNB (글로벌 네비게이션)
6. 시스템 아키텍처
7. 데이터베이스 스키마
8. 결제 시스템 통합
9. 화면 명세
10. 영수증·증빙
11. 비기능 요구사항

---

## 1. 용어 정의

> 비영리기관 후원금 관리 도메인에서 통용되는 독자적 용어를 사용한다.
> 타 제품(MRM, 도너스 등)의 메뉴명·기능명을 그대로 차용하지 않는다.

| 용어 | 영문 (코드명) | 정의 |
|------|-------------|------|
| **후원자** | member | 후원 의사를 표명하고 등록된 개인 또는 법인. 단순 캠페인 방문자와 구분. |
| **후원 약정** | promise | 후원자가 특정 캠페인에 대해 체결한 후원 계획. 금액·방법·주기·상태를 포함한다. 정기 약정과 일시 약정으로 구분. |
| **납입 내역** | payment | 약정에 따라 실제 이루어진 개별 결제 건. 납부 상태(납부완료·미납·취소·환불)와 소득공제 상태를 추적한다. |
| **정기 후원** | regular | 약정된 주기(월납·연납)로 반복 납입하는 후원 유형. 자동이체(CMS) 또는 카드 자동결제로 처리. |
| **일시 후원** | onetime | 단건으로 이루어지는 후원. PG 결제(카드·계좌이체·간편결제)로 처리. |
| **캠페인** | campaign | 후원금을 모집하는 프로젝트 단위. 목표금액·기간·결제 설정을 포함하며 고유 슬러그로 접근 가능한 공개 페이지를 가진다. |
| **자동이체** | cms (CMS) | 후원자의 계좌·카드에서 약정일에 자동으로 출금하는 방식. 금융결제원 CMS(Collection Management System) 기반. |
| **출금 오류** | cms_error | CMS 자동이체 실행 시 잔액 부족·계좌 해지 등으로 출금에 실패한 상태. 재출금 처리 대상. |
| **미납** | unpaid | 납입일이 경과했으나 납입 내역이 존재하지 않거나 출금 오류 상태인 약정·납입 건. |
| **소득공제** | income_deduction | 후원금에 대한 세법상 소득공제 처리 여부. 후원자가 연말정산에 사용하는 기부금 영수증의 발행 근거. |
| **기부금 영수증** | receipt | 소득공제를 위해 발행하는 공식 증빙 서류. 국세청 서식 기준으로 자체 생성하며 PDF로 제공. |
| **후원 채널** | join_path | 후원자가 유입된 경로(웹 캠페인·오프라인·SMS·이메일 등). 유입 경로 분석에 사용. |
| **약정 상태** | promise_status | 약정의 현재 상태. `active`(진행중) · `suspended`(일시중단) · `cancelled`(해지) · `completed`(완료). |
| **납부 상태** | payment_status | 개별 납입 건의 상태. `paid`(납부완료) · `unpaid`(미납) · `failed`(실패) · `cancelled`(취소) · `refunded`(환불). |

---

## 2. 서비스 범위

### Phase 1 (현재 구현 범위)

| 영역 | 포함 기능 |
|------|-----------|
| 공개 캠페인 | 캠페인 랜딩 페이지, 후원 신청 폼, 결제 완료 화면 |
| 후원자 마이페이지 | 납입 내역 조회, 약정 조회, 기부금 영수증 다운로드, 프로필 관리 |
| 관리자 — 후원자 관리 | 후원자 목록·검색·필터, 후원자 상세(약정·납입·영수증·메모·이력 탭) |
| 관리자 — 결제 관리 | 납부현황 조회, 미납 관리, 정기 스케줄, 출금 오류 처리 |
| 관리자 — 캠페인 관리 | 캠페인 CRUD, 공개/비공개 전환, 목표 금액 추적 |
| 관리자 — 재무·영수증 | 기부금 영수증 일괄 발행, 영수증 이력 조회 |
| 관리자 — 대시보드 | KPI 위젯, 납입 현황 차트, 미납 알림 |
| 결제 | Toss Payments PG (카드·계좌이체·간편결제), Toss CMS 자동이체 |
| 영수증 | @react-pdf/renderer 자체 생성 PDF, Supabase Storage 보관 |

### Phase 2 (향후 구현)

- ERP 연동 (회계 전표 자동 생성)
- CRM 연동 (후원자 관계 관리 고도화)
- 국세청 기부금 API 연동 (전자 영수증 발행)
- 문자·이메일 자동 알림 (미납 독촉, 영수증 발송)
- 다단계 캠페인 (매칭 기부, 목표 단계별 달성)
- 법인 후원자 관리

---

## 3. SaaS 멀티테넌트 구조

### 3.1 서비스 모델

각 비영리단체(기관)는 독립된 **테넌트(tenant)**로 서비스를 구독한다. 하나의 Next.js 앱·Supabase 프로젝트를 공유하되, `org_id` 기반 RLS로 데이터를 완전 격리한다.

```
플랫폼 운영자 (슈퍼 어드민)
  └─ 테넌트 A: 사랑의열매 복지재단
  └─ 테넌트 B: 어린이재단
  └─ 테넌트 C: 환경운동연합
```

### 3.2 도메인 전략

| 접근 방식 | URL 예시 | 용도 |
|-----------|----------|------|
| 서브도메인 | `love.supporters.kr` | 단체 관리자·마이페이지 |
| 캠페인 공개 URL | `love.supporters.kr/c/hope-2026` | 후원자용 캠페인 랜딩 |
| 단체 랜딩페이지 | `love.supporters.kr` (루트) | 단체 소개 + 캠페인 목록 |
| 커스텀 도메인 | `donate.love.or.kr` (Phase 2) | 단체 자체 도메인 연결 |

#### 테넌트 식별 흐름 (Next.js Middleware)

```
요청 → middleware.ts
  → req.headers.host 파싱 → 서브도메인 추출
  → orgs 테이블 조회 (slug 또는 custom_domain 매칭)
  → org_id를 RequestContext에 주입
  → 이후 모든 API/DB 쿼리에 org_id 자동 필터링
```

### 3.3 용어 추가

| 용어 | 영문 | 정의 |
|------|------|------|
| **기관** | org (organization) | SaaS를 구독하는 비영리단체 단위. 독립된 테넌트. |
| **기관 슬러그** | org_slug | 서브도메인·URL에 사용되는 기관 고유 식별자 (예: `love`, `child`) |
| **단체 랜딩페이지** | org landing | 기관의 소개·활동·진행 캠페인을 보여주는 공개 대표 페이지 |
| **슈퍼 어드민** | super_admin | 플랫폼 운영자. 전체 테넌트 관리·구독 현황 조회 권한 보유 |
| **테넌트 관리자** | admin | 특정 기관의 관리자. 해당 org_id 범위 내 데이터만 접근 가능 |

### 3.4 단체 랜딩페이지 구성

단체 랜딩페이지(`/` 루트)는 해당 기관의 공개 대표 페이지로, 후원자를 캠페인으로 유입하는 관문이다.

#### 페이지 구성 섹션

| 섹션 | 내용 |
|------|------|
| 히어로 | 기관 로고·슬로건·대표 이미지, 주요 CTA 버튼 |
| 기관 소개 | 미션·비전·연혁 요약 (관리자 편집 가능) |
| 진행 중인 캠페인 | 활성 캠페인 카드 그리드 (목표 달성률 바 포함) |
| 후원 현황 | 누적 후원자 수·누적 금액 (공개 설정 시) |
| 후원 방법 안내 | 정기/일시 후원 절차 설명 |
| 푸터 | 기관명·사업자번호·주소·문의처 |

#### 관리자 편집 지원 항목 (단체 설정 메뉴)

- 기관명, 로고, 대표 이미지, 슬로건
- 소개 본문 (Rich Text)
- 공개 표시 항목 선택 (후원 현황 수치 공개 여부 등)
- 대표 색상 (accent 커스터마이징 — Phase 2)

### 3.5 라우트 구조 (멀티테넌트 반영)

```
[서브도메인: {slug}.supporters.kr]

app/
├── (landing)/                  # 단체 대표 랜딩페이지
│   └── page.tsx                # → /  (기관 소개 + 캠페인 목록)
│
├── (public)/                   # 캠페인 공개 페이지 (인증 불필요)
│   ├── c/[slug]/               # 캠페인 랜딩
│   ├── c/[slug]/apply/         # 후원 신청 폼
│   └── c/[slug]/done/          # 결제 완료
│
├── (donor)/                    # 후원자 마이페이지 (후원자 로그인)
│   ├── my/
│   ├── my/payments/
│   ├── my/subscriptions/
│   ├── my/receipts/
│   └── my/profile/
│
└── (admin)/                    # 기관 관리자 (관리자 로그인)
    ├── admin/
    ├── admin/donors/
    ├── admin/payments/
    ├── admin/campaigns/
    ├── admin/receipts/
    └── admin/settings/         # 기관 설정 (랜딩페이지 편집 포함)

[별도 도메인: platform.supporters.kr]

app/
└── (superadmin)/               # 플랫폼 운영자 전용
    ├── orgs/                   # 기관 목록·등록
    ├── subscriptions/          # 구독 현황
    └── settings/               # 플랫폼 설정
```

### 3.6 `orgs` 테이블

```sql
CREATE TABLE orgs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,        -- 서브도메인 식별자
  name            text NOT NULL,               -- 기관명
  business_no     text,                        -- 사업자번호
  logo_url        text,
  hero_image_url  text,
  tagline         text,                        -- 히어로 슬로건
  about           text,                        -- 소개 본문 (Rich Text HTML)
  contact_email   text,
  contact_phone   text,
  address         text,
  show_stats      boolean DEFAULT true,        -- 후원 현황 수치 공개 여부
  custom_domain   text UNIQUE,                 -- 커스텀 도메인 (Phase 2)
  plan            text DEFAULT 'basic',        -- 구독 플랜
  status          text DEFAULT 'active',       -- 'active' | 'suspended' | 'trial'
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

> `campaigns`, `members`, `promises`, `payments`, `receipts` 테이블 모두 `org_id uuid NOT NULL REFERENCES orgs(id)` 컬럼을 가지며, RLS 정책으로 테넌트 격리를 보장한다.

---

## 4. 디자인 시스템

### 3.1 색상 토큰

```css
:root {
  /* 배경 계층 */
  --bg:        #0a0a0f;   /* 최하위 배경 */
  --surface:   #13131a;   /* 카드·패널 배경 */
  --surface-2: #1c1c27;   /* 중첩 요소 배경 */
  --border:    #2a2a3a;   /* 경계선 */

  /* 텍스트 계층 */
  --text:      #f0f0f8;   /* 본문 */
  --muted:     #8888aa;   /* 보조 텍스트 */
  --muted-2:   #55556a;   /* 비활성 텍스트·아이콘 */

  /* 5대 의미색 */
  --accent:    #7c3aed;   /* CTA, 활성 내비게이션, 링크 */
  --positive:  #22c55e;   /* 납부완료, 정상, 성공 */
  --negative:  #ef4444;   /* 미납, 오류, 취소, 해지 */
  --warning:   #f59e0b;   /* 대기중, 일시중단, 주의 */
  --info:      #38bdf8;   /* 처리중, CMS, 정보 */

  /* 의미색 소프트 배경 */
  --accent-soft:   rgba(124, 58, 237, 0.12);
  --positive-soft: rgba(34, 197, 94,  0.12);
  --negative-soft: rgba(239, 68, 68,  0.12);
  --warning-soft:  rgba(245, 158, 11, 0.12);
  --info-soft:     rgba(56, 189, 248, 0.12);
}
```

### 3.2 상태 뱃지 매핑

| 상태 | 색상 토큰 | 적용 대상 |
|------|-----------|-----------|
| 납부완료 / 정상 / 성공 | `--positive` | payment_status: paid, promise_status: active |
| 미납 / 오류 / 해지 / 취소 | `--negative` | payment_status: unpaid/failed/cancelled, promise_status: cancelled |
| 대기중 / 일시중단 / 주의 | `--warning` | payment_status: pending, promise_status: suspended |
| 처리중 / CMS / 정보 | `--info` | payment_status: processing, cms 방식 |
| CTA / 활성 | `--accent` | 버튼 primary, 활성 내비 아이템 |

### 3.3 타이포그래피

| 용도 | 크기 | 굵기 |
|------|------|------|
| 페이지 제목 | 24px | 700 |
| 섹션 제목 | 18px | 600 |
| KPI 숫자 | 32px | 700 |
| 본문 | 14px | 400 |
| 보조 | 12px | 400 |
| 뱃지·레이블 | 11px | 500 |

### 3.4 간격·반경

- 카드 padding: 24px
- 카드 border-radius: 12px
- 버튼 border-radius: 8px
- 인풋 border-radius: 8px
- 테이블 행 높이: 48px

---

## 4. GNB (글로벌 네비게이션)

### 4.1 구조 원칙

- 사이드바 형태, 기본 너비 **240px**, 접힌 상태 **52px**
- 메뉴 항목은 **그룹 헤더** + **서브 아이템** 2단 계층
- 그룹 헤더만 **SVG 아웃라인 아이콘** 표시 (색상: `--muted-2` `#55556a`)
- 서브 아이템은 **텍스트만** (아이콘 없음), `padding-left: 52px`
- 그룹 헤더 우측 **쉐브론(▶)** 클릭으로 확장/축소
- 왼쪽 상단 **토글 버튼**으로 사이드바 전체 접기/펴기
- 접힌 상태(52px)에서는 그룹 헤더 아이콘만 표시

### 4.2 메뉴 구조

```
▶ 개요                          [ChartBar 아이콘]
    └─ 대시보드
▶ 후원자 관리                    [Users 아이콘]
    ├─ 후원자 목록
    └─ 후원자 등록
▶ 결제 관리                      [CreditCard 아이콘]
    ├─ 납부현황
    ├─ 미납 관리               [배지: --negative]
    ├─ 정기 스케줄
    └─ 출금 오류               [배지: --warning]
▶ 캠페인                         [Megaphone 아이콘]
    ├─ 캠페인 목록
    └─ 캠페인 등록
▶ 재무·영수증  (기본 접힘)        [DocumentText 아이콘]
    ├─ 기부금 영수증 발행
    └─ 영수증 이력
▶ 시스템 설정  (기본 접힘)        [Cog 아이콘]
    ├─ 조직 정보
    └─ 관리자 계정
```

### 4.3 활성 상태

- 활성 서브 아이템: `background: --accent-soft`, `color: --accent`, `font-weight: 600`
- 활성 그룹 헤더(하위 활성 시): 아이콘 색상 `--accent`
- 비활성 그룹 헤더: 아이콘 색상 `--muted-2`

---

## 5. 시스템 아키텍처

### 5.1 Next.js 라우트 그룹

```
app/
├── (public)/                   # 인증 불필요
│   ├── c/[slug]/               # 캠페인 랜딩 페이지
│   ├── c/[slug]/apply/         # 후원 신청 폼
│   ├── c/[slug]/done/          # 결제 완료
│   └── campaigns/              # 캠페인 목록
│
├── (donor)/                    # 후원자 로그인 필요
│   ├── my/                     # 마이페이지 홈
│   ├── my/payments/            # 납입 내역
│   ├── my/subscriptions/       # 약정 현황
│   ├── my/receipts/            # 기부금 영수증
│   └── my/profile/             # 프로필 관리
│
└── (admin)/                    # 관리자 로그인 필요
    ├── admin/                  # 대시보드
    ├── admin/donors/           # 후원자 목록
    ├── admin/donors/[id]/      # 후원자 상세
    ├── admin/payments/         # 납부현황
    ├── admin/unpaid/           # 미납 관리
    ├── admin/schedules/        # 정기 스케줄
    ├── admin/cms-errors/       # 출금 오류
    ├── admin/campaigns/        # 캠페인 관리
    ├── admin/receipts/         # 영수증 발행·이력
    └── admin/settings/         # 시스템 설정
```

### 5.2 인증 플로우

- **관리자**: Supabase Auth (이메일+패스워드) → `user_metadata.role === 'admin'` 체크 → `/admin` 라우트 접근
- **후원자**: Supabase Auth (이메일 또는 소셜) → `/my` 라우트 접근, `members.supabase_uid`로 연결
- **공개**: 인증 없이 접근, `/c/[slug]` 캠페인 랜딩

### 5.3 API 구조

```
app/api/
├── webhooks/toss/              # Toss Payments 웹훅 수신 (단일 엔드포인트)
├── payments/                   # 결제 승인·조회
├── cms/                        # CMS 등록·해지·재출금
├── receipts/generate/          # PDF 영수증 생성
├── admin/
│   ├── donors/                 # 후원자 CRUD
│   ├── payments/               # 납입 내역 관리
│   ├── campaigns/              # 캠페인 CRUD
│   └── reports/                # 집계·통계
└── my/                         # 후원자 마이페이지 API
```

---

## 6. 데이터베이스 스키마

### 6.1 핵심 테이블 (4개)

#### `campaigns` — 캠페인

```sql
CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,           -- URL 식별자 (예: hope-2026)
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  donation_type   text NOT NULL,                  -- 'regular' | 'onetime' | 'both'
  goal_amount     bigint,                         -- 목표 금액 (원)
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text NOT NULL DEFAULT 'draft',  -- 'draft' | 'active' | 'closed'
  pg_config       jsonb,                          -- Toss 결제 설정 (clientKey 등)
  preset_amounts  jsonb,                          -- 선택 금액 버튼 [10000,30000,50000]
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

#### `members` — 후원자

```sql
CREATE TABLE members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_code     text UNIQUE NOT NULL,           -- 후원자 코드 (M-20260001)
  supabase_uid    uuid REFERENCES auth.users(id), -- 마이페이지 연결 (nullable)
  name            text NOT NULL,
  phone           text,                           -- 암호화 저장
  email           text,
  birth_date      date,                           -- 암호화 저장
  status          text NOT NULL DEFAULT 'active', -- 'active' | 'inactive' | 'deceased'
  member_type     text NOT NULL DEFAULT 'individual', -- 'individual' | 'corporate'
  join_path       text,                           -- 'web' | 'offline' | 'sms' | 'email' | 'referral'
  note            text,                           -- 관리자 메모
  org_id          uuid,                           -- 소속 조직 (법인 후원자용)
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

#### `promises` — 후원 약정

```sql
CREATE TABLE promises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promise_code    text UNIQUE NOT NULL,           -- 약정 코드 (P-20260001)
  member_id       uuid NOT NULL REFERENCES members(id),
  campaign_id     uuid NOT NULL REFERENCES campaigns(id),
  type            text NOT NULL,                  -- 'regular' | 'onetime'
  amount          bigint NOT NULL,                -- 약정 금액 (원)
  pay_day         integer,                        -- 납입일 (1~28, 정기 약정에만 사용)
  pay_method      text NOT NULL,                  -- 'card' | 'bank_transfer' | 'cms' | 'kakao_pay' | 'naver_pay'
  status          text NOT NULL DEFAULT 'active', -- 'active' | 'suspended' | 'cancelled' | 'completed'
  toss_billing_key text,                          -- CMS·카드 자동결제 빌링키
  started_at      date NOT NULL,
  ended_at        date,                           -- 해지 또는 완료일
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

#### `payments` — 납입 내역

```sql
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_code    text UNIQUE NOT NULL,           -- 납입 코드 (PMT-20260001)
  member_id       uuid NOT NULL REFERENCES members(id),
  promise_id      uuid REFERENCES promises(id),   -- 일시 후원은 nullable
  campaign_id     uuid NOT NULL REFERENCES campaigns(id),
  amount          bigint NOT NULL,                -- 실제 납입 금액 (원)
  pay_date        date NOT NULL,                  -- 납입 예정일
  deposit_date    timestamptz,                    -- 실제 입금 확인일
  pay_status      text NOT NULL DEFAULT 'unpaid', -- 'paid' | 'unpaid' | 'failed' | 'cancelled' | 'refunded'
  income_status   text NOT NULL DEFAULT 'pending',-- 'pending' | 'confirmed' | 'excluded'
  pg_tx_id        text,                           -- Toss 거래 ID
  pg_method       text,                           -- 실제 결제 수단
  fail_reason     text,                           -- 실패·오류 사유
  receipt_id      uuid REFERENCES receipts(id),   -- 발행된 영수증 연결
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
```

#### `receipts` — 기부금 영수증

```sql
CREATE TABLE receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_code    text UNIQUE NOT NULL,           -- 영수증 번호 (RCP-2026-00001)
  member_id       uuid NOT NULL REFERENCES members(id),
  year            integer NOT NULL,               -- 귀속 연도
  total_amount    bigint NOT NULL,                -- 영수증 상 총 금액
  pdf_url         text,                           -- Supabase Storage URL
  issued_at       timestamptz,
  issued_by       uuid,                           -- 발행 관리자 uid
  created_at      timestamptz DEFAULT now()
);
```

### 6.2 인덱스

```sql
-- 후원자 검색
CREATE INDEX idx_members_name ON members(name);
CREATE INDEX idx_members_phone ON members(phone);
CREATE INDEX idx_members_email ON members(email);

-- 약정 조회
CREATE INDEX idx_promises_member ON promises(member_id);
CREATE INDEX idx_promises_campaign ON promises(campaign_id);
CREATE INDEX idx_promises_status ON promises(status);

-- 납입 내역 조회
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_promise ON payments(promise_id);
CREATE INDEX idx_payments_pay_date ON payments(pay_date);
CREATE INDEX idx_payments_status ON payments(pay_status);

-- 캠페인 슬러그
CREATE UNIQUE INDEX idx_campaigns_slug ON campaigns(slug);
```

### 6.3 RLS (Row Level Security)

| 테이블 | 정책 |
|--------|------|
| `campaigns` | 공개(status=active): 전체 조회 가능. 관리자: 전체 CRUD |
| `members` | 본인(`supabase_uid`): 자신의 row만 조회. 관리자: 전체 CRUD |
| `promises` | 본인: 자신의 약정 조회. 관리자: 전체 CRUD |
| `payments` | 본인: 자신의 납입 내역 조회. 관리자: 전체 CRUD |
| `receipts` | 본인: 자신의 영수증 조회. 관리자: 전체 CRUD |

---

## 7. 결제 시스템 통합

### 7.1 Toss Payments 선택 근거

- **단일 SDK**로 PG + CMS 동시 처리 가능
- 빌링키 발급 → 정기결제 자동화 (카드 자동결제)
- CMS 자동이체 (계좌 자동출금) 통합 제공
- 단일 웹훅 엔드포인트로 모든 결제 이벤트 수신

### 7.2 결제 수단별 플로우

#### 일시 후원 (PG)

```
[후원자] 결제 폼 → Toss Widget 렌더링
         → 결제 수단 선택 (카드/계좌/간편결제)
         → [Toss] 결제창 → 인증
         → /c/[slug]/done?paymentKey=&orderId=&amount=
         → [서버] /api/payments/confirm (결제 승인 API 호출)
         → [DB] payments 레코드 생성 (pay_status: paid)
```

#### 정기 후원 — 카드 자동결제

```
[후원자] 카드 등록 폼 → Toss 빌링키 발급
         → [서버] promises 생성 (toss_billing_key 저장)
         → [스케줄러] 매월 pay_day에 자동결제 API 호출
         → [Toss 웹훅] 결제 결과 → /api/webhooks/toss
         → [서버] payments 레코드 업데이트
```

#### 정기 후원 — CMS 자동이체

```
[후원자] 계좌 정보 입력 → CMS 동의서 작성
         → [서버] /api/cms/register (Toss CMS 등록 API)
         → promises 생성 (pay_method: cms)
         → [금융결제원] 매월 pay_day에 출금
         → [Toss 웹훅] 출금 결과 → /api/webhooks/toss
         → [서버] 성공: payments paid 처리 / 실패: failed + fail_reason 저장
```

### 7.3 웹훅 이벤트 처리

```typescript
// /api/webhooks/toss
// 처리할 이벤트 유형
const handlers = {
  'PAYMENT_STATUS_CHANGED':  handlePaymentStatusChanged,
  'BILLING_KEY_DELETED':     handleBillingKeyDeleted,
  'CMS_PAYMENT_SUCCEEDED':   handleCmsSuccess,
  'CMS_PAYMENT_FAILED':      handleCmsFailed,
};
```

### 7.4 환경변수

```env
TOSS_CLIENT_KEY=...            # 프론트엔드 (공개)
TOSS_SECRET_KEY=...            # 서버사이드 (비공개)
TOSS_WEBHOOK_SECRET=...        # 웹훅 서명 검증
```

---

## 8. 화면 명세

### 8.1 대시보드 (`/admin`)

**상단 KPI 위젯 4종**
- 이달 후원금 (원, MoM 증감%)
- 활성 후원자 수 (신규 N명 포함)
- 미납 건수 (긴급 배지: --negative)
- 이달 신규 약정

**차트 영역**
- 월별 납입 현황 바차트 (최근 6개월, 일시/정기 구분)
- 결제 수단 분포 도넛 차트

**미납 알림 목록**
- 미납 3일 이상 상위 10건 (후원자명 · 금액 · 경과일)
- "미납 관리 보기" 링크

### 8.2 후원자 목록 (`/admin/donors`)

**필터 바**
- 검색 (이름/전화/이메일/후원자코드)
- 상태 (전체/활성/비활성)
- 후원 유형 (전체/정기/일시)
- 캠페인 선택
- 기간 필터 (등록일 기준)

**요약 바** (필터 적용 결과)
- 총 N명 · 활성 N명 · 정기 후원 N명 · 이달 누적 N원

**테이블 컬럼**
- 후원자코드 · 이름 · 전화 · 이메일 · 약정 유형 · 상태 뱃지 · 이달 납입액 · 등록일 · 액션

### 8.3 후원자 상세 (`/admin/donors/[id]`)

**좌측 기본 정보 패널**
- 이름 · 코드 · 상태 뱃지
- 전화 · 이메일 · 생년월일 · 후원 채널

**우측 탭 패널 (5탭)**

| 탭 | 주요 내용 |
|----|-----------|
| 약정 현황 | 약정 목록 (코드·캠페인·유형·금액·납입일·상태), 약정 상세 accordion |
| 납입 내역 | 납입 테이블 (날짜·금액·상태·수단·거래ID), 오른쪽에 타임라인 패널 |
| 기부금 영수증 | 연도별 영수증 목록, PDF 다운로드, 재발행 버튼 |
| 메모 | 관리자 메모 CRUD (작성자·날짜 표시) |
| 변경 이력 | 상태 변경·약정 변경 이력 (timestamp + 변경자) |

**납입 내역 타임라인 패널** (우측 고정)
- 최근 12개월 월별 납입 현황 (O/X 표시)
- 총 납입 횟수 / 미납 횟수 요약

### 8.4 결제 관리 (`/admin/payments`)

**탭 구조**

| 탭 | 내용 |
|----|------|
| 납부현황 | 전체 납입 내역 테이블 (기간·상태 필터) |
| 미납 관리 | 미납·실패 건 목록, 재청구 액션, 메모 추가 |
| 정기 스케줄 | 이번 달 출금 예정 캘린더/테이블 뷰 |
| 출금 오류 | CMS 실패 건 목록, 원인·재출금 처리 |

### 8.5 캠페인 랜딩 페이지 (`/c/[slug]`)

**관리자 쉘 없음, 공개 전용 레이아웃**

- 히어로 섹션 (캠페인 썸네일, 제목, 설명)
- 진행 현황 바 (목표 대비 달성률 %)
- 후원 신청 폼
  - 후원 유형 선택 (일시/정기)
  - 금액 선택 (preset 버튼 또는 직접 입력)
  - 개인정보 입력 (이름·전화·이메일)
  - 납입일 선택 (정기 시)
  - 결제 수단 선택 → Toss Widget 렌더링

### 8.6 후원자 마이페이지 (`/my`)

**좌측 네비게이션**
- 내 후원 현황 홈
- 납입 내역
- 약정 현황
- 기부금 영수증
- 프로필 설정

**홈 화면**
- 올해 총 납입액 · 납입 횟수
- 최근 납입 내역 5건
- 약정 현황 요약 카드
- 기부금 영수증 바로가기

---

## 9. 영수증·증빙

### 9.1 기부금 영수증 생성

- **라이브러리**: `@react-pdf/renderer`
- **서식**: 국세청 기부금 영수증 양식 기준
- **포함 정보**: 기부자 성명·생년월일·주소, 기부금 유형, 기부일자, 금액, 단체명·사업자번호·대표자
- **생성 시점**: 관리자 수동 발행 또는 연말 일괄 발행
- **저장**: Supabase Storage `receipts/{year}/{member_id}/{receipt_code}.pdf`
- **접근**: Signed URL (7일 유효) 생성 후 다운로드 링크 제공

### 9.2 발행 프로세스

```
관리자 → 후원자 선택 → 귀속 연도 지정 → 납입 내역 자동 집계
       → PDF 미리보기 → 발행 확정
       → [서버] PDF 생성 → Storage 업로드
       → receipts 레코드 생성 → payments.receipt_id 연결
       → 후원자 이메일 발송 (Phase 2)
```

---

## 10. 비기능 요구사항

### 10.1 보안

- 개인정보(전화번호·생년월일) DB 암호화 저장 (AES-256 또는 Supabase Vault)
- RLS로 후원자별 데이터 격리
- 관리자 API: `Authorization` 헤더 + Supabase 세션 검증
- Toss 웹훅: HMAC 서명 검증 필수
- 결제 관련 민감 정보(카드번호 등) 서버 미저장 (Toss 측 보관)

### 10.2 성능

- 대시보드 KPI: Supabase 집계 쿼리 최적화 (materialized view 고려)
- 후원자 목록: 페이지네이션 (20건/페이지) + 커서 기반 무한 스크롤
- PDF 생성: 백그라운드 처리 (Supabase Edge Function 또는 서버 액션)

### 10.3 접근성

- 색상만으로 상태 구분하지 않음 (뱃지에 텍스트 병기)
- 키보드 내비게이션 지원
- WCAG 2.1 AA 기준 준수 목표

### 10.4 환경 구성

```
개발:   로컬 Next.js dev + Supabase local (Docker)
스테이징: Vercel Preview + Supabase 스테이징 프로젝트
운영:   Vercel Production + Supabase 운영 프로젝트
```

---

## 부록: 파일 구조 (예상)

```
src/
├── app/
│   ├── (public)/c/[slug]/
│   ├── (donor)/my/
│   └── (admin)/admin/
├── components/
│   ├── ui/              # shadcn/ui 기본 컴포넌트
│   ├── gnb/             # 사이드바 네비게이션
│   ├── dashboard/       # 대시보드 위젯
│   ├── donors/          # 후원자 관련 컴포넌트
│   ├── payments/        # 결제 관련 컴포넌트
│   ├── campaigns/       # 캠페인 관련 컴포넌트
│   └── receipt/         # 영수증 PDF 템플릿
├── lib/
│   ├── supabase/        # Supabase 클라이언트 (server/client)
│   ├── toss/            # Toss Payments 유틸
│   ├── pdf/             # 영수증 PDF 생성
│   └── utils.ts
└── types/
    └── index.ts         # 전역 타입 정의
```

---

*이 문서는 Phase 1 구현의 기준 설계서입니다. 실제 구현 과정에서 세부 사항은 조정될 수 있습니다.*
