# SP-6: 품질 마감 — i18n · a11y · 모션 (2026-04-24)

## 목적

모든 SP 완료 후 최종 감사. 337개 한글 하드코딩 → i18n 키 전수 치환, WCAG 2.1 AA 달성, `prefers-reduced-motion` 대응.

---

## 현황 GAP

| GAP | 내용 | 위치 |
|-----|------|------|
| G17 | i18n 사전 20개 키 — 337개 한글 문자열 미등록 | `src/lib/i18n/donor.ts` |
| G18 | 주요 페이지에서 `getT()` 미호출 | impact, promises, receipts 페이지 |
| G19 | OTP form input `<label>` 없음 (SP-5에서 처리) | `otp-login-form.tsx` |
| G20 | `<table>` caption 없음 | `impact/page.tsx:273` |
| G21 | emoji `aria-hidden` 미처리 | 다수 페이지 emoji 텍스트 |
| G22 | LocaleToggle layout 통합 위치 불명확 | `donor-nav.tsx` 또는 footer |

---

## 설계 결정

### D12: MyPage 전체 i18n 적용

**기존 i18n 인프라** (`src/lib/i18n/donor.ts`):
- `getT()` — 서버 컴포넌트용 `t(key)` 함수
- `readDonorLocaleFromDocument()` — 클라이언트용
- 메시지 파일 구조: `src/lib/i18n/messages/ko.ts`, `en.ts`

**전략**: 기존 자체 i18n 시스템을 유지·확장 (외부 라이브러리 도입 YAGNI).

**작업 순서**:
1. `src/lib/i18n/messages/ko.ts` — 337개 한글 문자열 전수 키 등록
2. `src/lib/i18n/messages/en.ts` — 영어 번역 추가
3. 각 페이지/컴포넌트에 `getT()` / `readDonorLocaleFromDocument()` 적용

**키 네이밍 규칙**:
```typescript
// 기존 패턴 준수
donor.nav.home = '홈'
donor.dashboard.greeting.morning = '좋은 아침이에요'
donor.dashboard.greeting.afternoon = '안녕하세요'
donor.dashboard.greeting.evening = '좋은 저녁이에요'
donor.dashboard.stats.total_donated = '누적 후원액'
donor.dashboard.stats.active_pledges = '활성 약정'
// ...
```

**우선순위 파일** (영향 범위 큰 순):
1. `src/app/(donor)/donor/page.tsx` — 대시보드 (가장 많은 노출)
2. `src/app/(donor)/donor/promises/page.tsx`
3. `src/app/(donor)/donor/impact/page.tsx`
4. `src/app/(donor)/donor/payments/page.tsx`
5. `src/app/(donor)/donor/receipts/page.tsx`
6. `src/app/(donor)/donor/settings/page.tsx`
7. `src/components/donor/` 하위 컴포넌트 전체

**클라이언트 컴포넌트 전략**: `readDonorLocaleFromDocument()`가 쿠키에서 로케일을 읽음. 클라이언트 컴포넌트에 `locale` prop을 서버에서 내려주거나, 클라이언트 훅으로 처리.

```typescript
// src/lib/i18n/use-donor-locale.ts (신규 — 클라이언트 훅)
'use client'
export function useDonorT() {
  const locale = readDonorLocaleFromDocument() // 쿠키 기반
  return (key: string) => getMessage(locale, key)
}
```

### D13: WCAG 2.1 AA 감사

**체크리스트**:

**1. 색 대비 (SC 1.4.3, 4.5:1 이상)**
- `var(--accent)` 배경 위 흰 텍스트 (`#fff`) — accent 색이 테마별로 다를 수 있어 확인 필요
- `var(--muted-foreground)` 위 소형 텍스트 — 3:1 이상 (큰 텍스트) 또는 4.5:1 (일반)
- 검사 도구: `src/app/design-check/page.tsx`가 이미 존재 → 여기서 대비 확인 통합

**2. 키보드 탐색 (SC 2.1.1)**
- 드롭다운 메뉴(`DonorNav`) — `role="menu"`, `aria-expanded`, `Esc` 닫기 이미 구현됨 (mypage-aggregation 스펙)
- 모달 — `focus-trap` 적용 여부 확인 (`CancelConfirmModal`, `ReauthModal`)
- 링크 vs 버튼 — `<a>`는 href, `<button>`은 타입 명시

**3. 스크린리더 (SC 4.1.2)**
- G20: `<table caption>` 추가 — `impact/page.tsx` 연도별 상세 테이블
- G21: emoji `aria-hidden` 처리

```tsx
// 수정 전
<p>🎁 첫 후원을 시작해보세요</p>

// 수정 후
<p>
  <span aria-hidden="true">🎁</span>{' '}
  첫 후원을 시작해보세요
</p>
```

- `StatPill`, `SectionHeader` — 수치 읽기 순서 검증

**4. 폼 레이블 (SC 1.3.1)**
- OTP form — SP-5에서 처리
- `payments-export-bar.tsx` 필터 — `<label>` 연결 확인
- `NotificationPrefsForm` — 스위치 aria-checked 확인

**5. 오류 식별 (SC 3.3.1)**
- 폼 오류 메시지에 `role="alert"` 또는 `aria-live="polite"` 적용

### G22: LocaleToggle 위치 확정

현재 `LocaleToggle`은 `/donor/settings`에만 있음. 더 접근하기 쉬운 위치 필요.

**결정**: `DonorNav` 하단 또는 `donor/layout.tsx` 푸터 영역에 추가.

```tsx
// src/app/(donor)/donor/layout.tsx
<footer className="mt-auto pt-4 pb-8 text-center">
  <LocaleToggle />
</footer>
```

### D14: `prefers-reduced-motion` 대응

**영향 받는 요소**:
- 히어로 섹션 배경 그라데이션 애니메이션 (있다면)
- 임팩트 차트 트랜지션 (`ImpactMonthlyHeatmap`, 도넛 차트)
- Suspense skeleton shimmer 애니메이션 (SP-1에서 신규 추가)
- `transition-opacity hover:opacity-80` — 일반적으로 OK (빠른 전환)

**구현**:
```css
/* src/app/globals.css 추가 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

차트 라이브러리가 사용된다면 라이브러리별 `animation: false` 옵션 추가.

---

## 실행 계획

SP-6은 단일 큰 PR보다 **파일 단위 순차 PR**로 진행:

| PR | 범위 | 작업 |
|----|------|------|
| 6-1 | i18n 사전 | `ko.ts`, `en.ts` 전수 키 추가 |
| 6-2 | 대시보드·설정 | `page.tsx`, `settings/page.tsx` getT() 적용 |
| 6-3 | 임팩트·약정·납입·영수증 | 나머지 주요 페이지 getT() 적용 |
| 6-4 | 컴포넌트 | `src/components/donor/` 하위 전체 |
| 6-5 | a11y 패치 | emoji aria-hidden, table caption, label 연결 |
| 6-6 | reduced-motion | globals.css + 차트 옵션 |
| 6-7 | LocaleToggle 위치 | layout.tsx footer 추가 |

---

## 완료 기준

| 항목 | 기준 |
|------|------|
| i18n 커버리지 | `(donor)/donor/` 한글 하드코딩 0건 (grep "[가-힣]" 결과 0) |
| 영어 번역 | `en` 로케일 전환 시 모든 텍스트 영어 표시 |
| 색 대비 | `design-check` 페이지 대비 비율 모두 4.5:1+ |
| emoji | `aria-hidden="true"` 전수 처리 |
| table caption | impact 연도별 상세 테이블 caption 존재 |
| reduced-motion | 모션 감소 설정 시 애니메이션 없음 |
| LocaleToggle | layout footer에서 접근 가능 |
| Lighthouse a11y | ≥ 95 |

---

## 제외 (YAGNI)

- RTL(아랍어 등) 레이아웃
- 일본어·중국어 번역 (ko·en 2개 언어 완성 후 결정)
- 외부 i18n 라이브러리 도입 (자체 구현으로 충분)
- WCAG 2.2 새 기준 (AA 우선, AAA는 이후)

---

## 선행 조건

SP-1~5 완료 후 진행 권장. 신규 컴포넌트가 추가된 후 한 번에 i18n·a11y 감사하는 것이 효율적.
