# Sub-1: 후원 플로우 UI/UX 고도화 설계

**작성일**: 2026-04-17
**범위**: 기관별 테마 시스템 + 위저드 UI 고도화 + 레거시 폼 디자인 통일 + 메인 공개 페이지 개선
**상위 프로젝트**: NPO 후원관리시스템 — 후원자 플로우 고도화
**서브프로젝트 순서**: Sub-1 (현재) → Sub-2 본인인증+마이페이지 → Sub-3 정기후원 CMS → Sub-4 영수증+알림

---

## 1. 배경 및 목표

### 현재 상태
- 메인 공개 페이지(`(public)/page.tsx`): 기본 구조 완성, 디자인 토큰 적용됨
- 위저드(`/donate/wizard`): 3스텝 플로우 동작하지만 `bg-rose-500` 등 하드코딩 색상, 단순한 UI
- 레거시 후원 폼(`donation-form.tsx`): 디자인 토큰 적용됨, 위저드와 디자인 불일치
- 두 벌의 후원 폼이 공존 (빌더 캠페인 → 위저드, 비빌더 → 레거시 폼)
- 기관 테마: 보라/다크 하드코딩, 기관별 커스터마이징 불가

### 목표
- 기관별 테마 커스터마이징 (accent 색상, 라이트/다크 모드)
- 위저드 UI를 월드비전/굿네이버스 수준으로 고도화
- 위저드와 레거시 폼의 디자인 언어 통일 (공유 컴포넌트 추출)
- 메인 공개 페이지 캠페인 카드 및 안내 섹션 개선
- 모바일 최적화 (하단 고정 CTA, 터치 친화적 크기)

---

## 2. 섹션별 변경 범위

### 섹션 1 — 기관별 테마 시스템

**DB 변경:**
- `orgs` 테이블에 `theme_config JSONB DEFAULT NULL` 컬럼 추가
- 마이그레이션 파일: `supabase/migrations/YYYYMMDD_org_theme_config.sql`

**`theme_config` 스키마:**
```typescript
type ThemeConfig = {
  mode: 'dark' | 'light';       // 기본: 'dark'
  accent: string;               // 기본: '#7c3aed'
  accentSoft: string;           // 기본: 'rgba(124,58,237,0.12)'
  bg?: string;                  // light일 때 '#ffffff' 등
  surface?: string;
  surfaceTwo?: string;
  text?: string;
  mutedForeground?: string;
  border?: string;
};
```

**적용 방식:**
- `src/app/(public)/layout.tsx`에서 테넌트의 `theme_config`를 로드
- `<style>` 태그로 CSS 변수 오버라이드 주입: `:root { --accent: ...; --bg: ...; }`
- `theme_config`가 null이면 현재 기본값(보라/다크) 폴백
- 관리자 화면은 영향 없음 (별도 레이아웃)

**관리자 UI:**
- `src/app/(admin)/admin/settings/page.tsx`에 "테마 설정" 섹션 추가
- accent 컬러 피커 (프리셋 5-6개 + 커스텀 입력)
- 라이트/다크 모드 토글
- 저장 API: `PATCH /api/admin/settings/theme`

**변경 파일:**
- `supabase/migrations/YYYYMMDD_org_theme_config.sql` (신규)
- `src/app/(public)/layout.tsx` (수정 — 테마 CSS 주입)
- `src/app/(admin)/admin/settings/page.tsx` (수정 — 테마 설정 UI 추가)
- `src/app/api/admin/settings/theme/route.ts` (신규)
- `src/lib/theme/config.ts` (신규 — ThemeConfig 타입 + 기본값 + CSS 변환)

---

### 섹션 2 — 위저드 UI 고도화

**스텝 프로그레스바:**
- 수평 바 형태: 원(숫자) + 라벨 + 연결선
- 현재 단계: `var(--accent)` 배경 + 흰색 숫자
- 완료 단계: `var(--accent)` 배경 + 체크마크(✓)
- 미완료 단계: `var(--surface-2)` 배경 + 회색 숫자
- 라벨: "후원 선택" → "정보 입력" → "결제 완료"
- 컴포넌트: `src/components/public/donation/StepProgressBar.tsx` (신규)

**Step 1 — 후원 선택:**
- 후원 유형 카드: 아이콘 + 제목 + 설명 텍스트 카드 UI
  - 일시후원: 한 번의 소중한 나눔
  - 정기후원: 매월 꾸준한 변화
- 금액 프리셋 카드: 금액 + 사용처 설명 텍스트
  - `form_settings`에 `amountDescriptions: Record<number, string>` 필드 추가
  - 예: `{ 10000: "아동 1명 한 달 학용품", 30000: "아동 1명 한 달 급식" }`
  - 설명이 없으면 금액만 표시
- 직접 입력: 숫자 포맷팅 (1,000 단위 콤마), 최소금액 안내
- 모든 하드코딩 색상 → 디자인 토큰
- 컴포넌트: `src/components/public/donation/AmountSelector.tsx` (신규, 공유)
- 컴포넌트: `src/components/public/donation/DonationTypeToggle.tsx` (신규, 공유)

**Step 2 — 정보 입력:**
- 입력 필드: `var(--surface-2)` 배경, `var(--border)` 테두리, `var(--text)` 색상
- 결제수단 선택: 아이콘 포함 카드형
  - 카드(신용/체크), 카카오페이, 네이버페이, 계좌이체, CMS
  - 아이콘은 텍스트 이모지 또는 간단한 SVG
- 약관 동의: "전체 동의" 체크박스 + 개별 약관 토글
- 기부금 영수증: 별도 섹션으로 시각적 분리 (border-top + 아이콘)
- 컴포넌트: `src/components/public/donation/PayMethodSelector.tsx` (신규, 공유)
- 컴포넌트: `src/components/public/donation/AgreementSection.tsx` (신규)

**Step 3 — 완료:**
- 감사 아이콘: 체크마크 원형 (이모지 대신 CSS 그래픽)
- 결제 정보 요약 카드 (금액, 결제수단, 접수번호)
- 다크테마 토큰 일괄 적용

**모바일 최적화:**
- 하단 고정 CTA: `position: sticky; bottom: 0` + 그라디언트 fade
- 터치 타겟: 모든 버튼/선택 영역 최소 44px 높이
- 금액 버튼 2열 그리드

**변경 파일:**
- `src/components/public/donation/StepProgressBar.tsx` (신규)
- `src/components/public/donation/AmountSelector.tsx` (신규)
- `src/components/public/donation/DonationTypeToggle.tsx` (신규)
- `src/components/public/donation/PayMethodSelector.tsx` (신규)
- `src/components/public/donation/AgreementSection.tsx` (신규)
- `src/app/donate/wizard/WizardClient.tsx` (수정 — 프로그레스바, 토큰)
- `src/app/donate/wizard/steps/Step1.tsx` (수정 — 카드형 UI, 토큰)
- `src/app/donate/wizard/steps/Step2.tsx` (수정 — 결제수단 아이콘, 약관, 토큰)
- `src/app/donate/wizard/steps/Step3.tsx` (수정 — 완료 화면 개선, 토큰)
- `src/lib/campaign-builder/form-settings/schema.ts` (수정 — amountDescriptions 추가)

---

### 섹션 3 — 레거시 후원 폼 디자인 통일

**공유 컴포넌트 재사용:**
- `donation-form.tsx`의 금액 선택 → `AmountSelector` 컴포넌트로 교체
- 결제수단 선택 → `PayMethodSelector` 컴포넌트로 교체
- 후원 유형 토글 → `DonationTypeToggle` 컴포넌트로 교체
- 이미 적용된 디자인 토큰은 유지, 누락된 부분만 수정

**모바일 최적화:**
- 하단 고정 CTA 버튼 (위저드와 동일 패턴)

**변경 파일:**
- `src/components/public/donation-form.tsx` (수정 — 공유 컴포넌트 교체)

---

### 섹션 4 — 메인 공개 페이지 개선

**캠페인 카드 개선:**
- 썸네일 없는 캠페인: 그라디언트 placeholder 배경
  - `background: linear-gradient(135deg, var(--accent-soft), var(--surface-2))`
- 카드 hover: `transform: scale(1.02)` + `shadow-lg` 트랜지션
- D-day 표시: `ended_at`이 있으면 카드 우측 상단에 "D-12" 배지
- "후원하기" 버튼: 카드 하단에 accent 색상 텍스트 링크

**후원 방법 안내 섹션:**
- 아이콘 추가: 스텝 번호 원 외에 아이콘(돋보기, 편집, 카드)
- accent 색상 적용 (기관 테마 반영)

**변경 파일:**
- `src/app/(public)/page.tsx` (수정 — 카드 개선, 안내 아이콘)

---

## 3. 변경하지 않는 것

- 후원 API 로직 (`/api/donations/prepare`, 웹훅, confirm)
- DB 스키마 (theme_config 추가 외)
- 라우팅 구조 (위저드 경로, 레거시 경로 유지)
- Toss SDK 연동 로직
- 오프라인 결제(CMS/계좌이체) 흐름
- 관리자 빌더 화면 (이미 고도화 완료)
- 블록 렌더러 (이미 다크테마 토큰 적용 완료)

---

## 4. 엣지 케이스

| 상황 | 처리 |
|------|------|
| `theme_config` null | 현재 기본값(보라/다크) 폴백 |
| accent 색상 접근성 위반 (너무 밝거나 어두움) | 컬러 피커에 프리셋 제공, 커스텀 입력 시 경고 없이 허용 (Phase 1) |
| `amountDescriptions` 미설정 | 금액만 표시, 설명 텍스트 숨김 |
| 결제수단 1개뿐 | PayMethodSelector 숨기고 자동 선택 |
| 후원 유형 1개뿐 | DonationTypeToggle 숨기고 자동 선택 |
| 라이트 모드에서 기존 하드코딩 색상 충돌 | 이 스펙에서 모든 하드코딩 색상 제거 |
| 모바일에서 하단 CTA가 키보드와 겹침 | `position: sticky` 사용 (fixed 아님) — 키보드 올라오면 자연스럽게 밀림 |

---

## 5. 범위 밖 (다음 Sub-project)

- Sub-2: 본인인증(PASS) + 후원자 로그인/마이페이지
- Sub-3: 정기후원 CMS (Toss Billing)
- Sub-4: 기부금 영수증 자동발급 + 감사 이메일/알림톡
