# 이메일 템플릿 라이브러리 설계

**작성일**: 2026-04-17
**범위**: 기관별 이메일 템플릿 CRUD + Tiptap WYSIWYG 편집 + 변수 치환 + 실시간 미리보기 + 기관 테마 반영 + 기존 발송 로직 통합
**상위 프로젝트**: NPO 후원관리시스템 — Gap Roadmap High Priority

---

## 1. 배경 및 목표

### 현재 상태
- 이메일 발송 경로 이원화: Resend(`src/lib/email.ts`) + Nodemailer SMTP(`src/lib/email/send-email.ts`)
- HTML 템플릿이 각 함수에 하드코딩 (3개: 후원완료, 오프라인접수, 영수증발급)
- 기관별 테마(accent, 로고)가 이메일에 미반영
- 관리자가 이메일 내용을 커스터마이징할 수 없음

### 목표
- 관리자가 WYSIWYG 에디터로 시나리오별 이메일 템플릿을 편집
- `{{변수}}` 자동완성 + 실시간 미리보기
- 기관 `theme_config`(accent 색상, 로고)가 이메일에 자동 반영
- 기존 발송 함수 시그니처 최소 변경으로 통합

---

## 2. 데이터 모델

### `email_templates` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | UUID PK DEFAULT gen_random_uuid() | |
| `org_id` | UUID NOT NULL FK → orgs ON DELETE CASCADE | 기관별 격리 |
| `scenario` | TEXT NOT NULL | 시나리오 식별자 |
| `subject` | TEXT NOT NULL | 제목 템플릿 (변수 포함 가능) |
| `body_json` | JSONB NOT NULL | Tiptap JSON 문서 |
| `body_html` | TEXT | 렌더링된 HTML 캐시 (저장 시 생성) |
| `is_active` | BOOLEAN NOT NULL DEFAULT true | 비활성 시 기본 시스템 템플릿 폴백 |
| `updated_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |
| `created_at` | TIMESTAMPTZ NOT NULL DEFAULT now() | |

**제약 조건**: UNIQUE `(org_id, scenario)` — 기관별 시나리오당 1개.

**RLS**: `org_id = (SELECT org_id FROM admin_users WHERE supabase_uid = auth.uid() LIMIT 1)` — 기존 패턴 동일.

### 시나리오 목록 (6종)

| scenario | 한글명 | 사용 변수 |
|----------|--------|-----------|
| `donation_thanks` | 후원 완료 감사 | `{{name}}`, `{{amount}}`, `{{type}}`, `{{orgName}}`, `{{campaignTitle}}`, `{{paymentCode}}`, `{{date}}` |
| `offline_received` | 오프라인 접수 안내 | 위 + `{{payMethod}}`, `{{bankName}}`, `{{bankAccount}}`, `{{accountHolder}}` |
| `receipt_issued` | 영수증 발급 완료 | `{{name}}`, `{{orgName}}`, `{{year}}`, `{{totalAmount}}`, `{{receiptCode}}`, `{{pdfUrl}}` |
| `billing_failed` | 자동결제 실패 알림 | `{{name}}`, `{{orgName}}`, `{{amount}}`, `{{reason}}` |
| `billing_reminder` | 결제 예정 사전 안내 | `{{name}}`, `{{orgName}}`, `{{amount}}`, `{{date}}` |
| `welcome` | 가입 환영 | `{{name}}`, `{{orgName}}` |

---

## 3. 아키텍처

### 레이어 구성

```
관리자 편집 UI (Tiptap + 미리보기)
  ↓
API (CRUD + preview + test-send)
  ↓
렌더러 (Tiptap JSON → 이메일 HTML + 변수 치환 + 테마 래핑)
  ↓
발송 (기존 email.ts 리팩토링 — resolveTemplate 호출)
```

### 파일 구조

#### 신규 파일
| 파일 | 역할 |
|------|------|
| `supabase/migrations/YYYYMMDD_email_templates.sql` | email_templates 테이블 + RLS |
| `src/lib/email/template-renderer.ts` | Tiptap JSON → 인라인 CSS 이메일 HTML 변환 + 변수 치환 |
| `src/lib/email/default-templates.ts` | 시나리오별 기본 Tiptap JSON + subject |
| `src/lib/email/resolve-template.ts` | DB 조회 → 커스텀 or 기본 폴백 → 렌더링 → {subject, html} 반환 |
| `src/app/api/admin/email-templates/route.ts` | GET (시나리오 목록), PUT (저장) |
| `src/app/api/admin/email-templates/preview/route.ts` | POST (미리보기 렌더링) |
| `src/app/api/admin/email-templates/test-send/route.ts` | POST (관리자에게 테스트 발송) |
| `src/app/(admin)/admin/email-templates/page.tsx` | 시나리오 카드 그리드 목록 |
| `src/app/(admin)/admin/email-templates/[scenario]/page.tsx` | 에디터 페이지 (Server Component wrapper) |
| `src/components/admin/email-template-editor.tsx` | Tiptap 에디터 + 변수 드롭다운 + 미리보기 `'use client'` |

#### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/lib/email.ts` | 각 함수 내부에서 `resolveTemplate()` 호출, `orgId` 파라미터 추가 |
| `src/lib/notifications/send.ts` | `orgId` 전달 추가 |
| `src/lib/donations/confirm.ts` | `orgId` 전달 추가 |
| `src/app/api/donations/prepare/route.ts` | `orgId` 전달 추가 |
| `src/components/admin/sidebar.tsx` | "이메일 템플릿" 메뉴 항목 추가 |

---

## 4. 렌더러 상세

### Tiptap JSON → 이메일 HTML 변환

Tiptap의 JSON 문서를 재귀 순회하여 이메일 호환 HTML 생성:

| Tiptap 노드 | HTML 출력 |
|-------------|-----------|
| `paragraph` | `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#333">` |
| `heading` (level 2) | `<h2 style="margin:0 0 12px;font-size:20px;color:#111">` |
| `heading` (level 3) | `<h3 style="margin:0 0 8px;font-size:16px;color:#111">` |
| `bulletList` | `<ul style="margin:0 0 12px;padding-left:20px">` |
| `orderedList` | `<ol style="margin:0 0 12px;padding-left:20px">` |
| `listItem` | `<li style="margin:0 0 4px">` |
| `bold` mark | `<strong>` |
| `italic` mark | `<em>` |
| `link` mark | `<a href="..." style="color:{{accent}};text-decoration:underline">` |
| `hardBreak` | `<br>` |
| unknown node | 무시 (graceful degradation) |

### 변수 치환

렌더링된 HTML에서 `{{variableName}}` 패턴을 정규식으로 치환:
```
/\{\{(\w+)\}\}/g → variables[match] ?? ''
```

### 기관 테마 래핑

최종 HTML을 이메일 base layout으로 래핑:
- `theme_config`에서 `accent`, `logo_url` 읽기
- 헤더: 로고 이미지(있으면) + 기관명
- 본문: 렌더링된 템플릿 HTML
- 푸터: "본 메일은 발신 전용입니다" + 기관 연락처
- 전체를 `<table>` 레이아웃 + 인라인 CSS로 구성 (이메일 호환)
- `theme_config=null`이면 기본값(accent=#7c3aed, 로고 없음)

---

## 5. 관리자 편집 UI

### 템플릿 목록 페이지 (`/admin/email-templates`)

- 6개 시나리오를 카드 그리드(2×3)로 표시
- 각 카드: 시나리오 아이콘 + 한글명 + 상태 배지("커스텀" / "기본") + 활성/비활성 토글
- 카드 클릭 → `/admin/email-templates/[scenario]`

### 에디터 페이지 (`/admin/email-templates/[scenario]`)

좌우 분할 레이아웃 (md 이상에서):

**좌측 (60%)**:
- 제목(subject) 텍스트 인풋
- Tiptap 에디터 (툴바: Bold, Italic, Link, H2, H3, BulletList, OrderedList)
- "변수 삽입" 드롭다운 버튼: 해당 시나리오의 사용 가능 변수 목록 → 클릭 시 `{{변수명}}` 삽입

**우측 (40%)**:
- iframe 미리보기: 샘플 데이터로 변수 치환 + 테마 래핑된 이메일 HTML
- 에디터 변경 시 500ms 디바운스로 클라이언트 사이드 자동 갱신

**버튼**:
- "저장" — PUT `/api/admin/email-templates`
- "기본값으로 초기화" — 확인 모달 후 기본 템플릿으로 리셋
- "테스트 발송" — 관리자 이메일로 실제 발송

### Tiptap 의존성
- `@tiptap/react`
- `@tiptap/starter-kit` (bold, italic, heading, list 포함)
- `@tiptap/extension-link`

---

## 6. 기존 코드 통합

### `src/lib/email.ts` 리팩토링

각 발송 함수의 파라미터에 `orgId: string` 추가. 내부 로직:

```
1. resolveTemplate(orgId, scenario, variables) 호출
2. {subject, html} 반환
3. 기존 Resend sendEmail()로 발송
```

기존 하드코딩 HTML은 `default-templates.ts`로 이동하여 DB 템플릿 없을 때 폴백으로 사용.

### 호출부 변경

`src/lib/notifications/send.ts`의 `notifyDonationThanks`, `notifyReceiptIssued` 등에서 `orgId`를 전달. 이미 `orgName`을 받고 있지만 `orgId`는 없으므로 파라미터 타입에 추가.

### 발송 경로 통일

- Resend를 primary로 유지
- `src/lib/email/send-email.ts` (Nodemailer)는 삭제하지 않으되, 신규 코드에서는 사용하지 않음

---

## 7. 엣지 케이스

| 상황 | 처리 |
|------|------|
| 기관이 템플릿을 저장한 적 없음 | `default-templates.ts`의 기본 JSON 사용 |
| 템플릿 `is_active=false` | 기본 템플릿 폴백 |
| 변수명 오타 (`{{nmae}}`) | 치환 안 됨 → 원문 그대로 출력. 미리보기에서 확인 가능 |
| body_json이 빈 배열 | 저장 시 validation — 최소 1개 노드 필수 |
| Tiptap JSON에 unknown node type | 렌더러가 무시 (graceful) |
| 기관 테마 없음 (`theme_config=null`) | 기본 accent (#7c3aed) + 로고 없이 기관명 텍스트만 |
| 이메일 클라이언트 CSS 미지원 | 모든 스타일 인라인, `<table>` 레이아웃, 웹폰트 미사용 |

---

## 8. 변경하지 않는 것

- 알림톡/SMS 발송 로직
- Toss 웹훅, cron 로직
- `fromAddress()` 함수
- Resend API 호출 방식
- 기존 이메일 발송 함수의 외부 인터페이스 (orgId 추가 외)
