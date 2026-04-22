# 다크/라이트 테마 토글 + 브랜드 로고 도입 (2026-04-22)

## 목적

NPO_S 서비스 전역에
1. **다크/라이트 테마 토글 인프라**를 구축한다 (사용자 선택 + OS 연동 + 기기 간 동기화).
2. **제품 브랜드 로고** "EverPayroll / 에버후원금관리"를 donor·admin 영역에 도입하고, public 캠페인 페이지 푸터에 "Powered by" 표기로 제품 정체성을 드러낸다.

본 스펙(A)은 Phase 7-D-3 MyPage 집약(Spec B)의 **선행 작업**이다. 라이트 톤에서 MyPage UI 검증이 가능해지도록 먼저 완료한다.

---

## 스코프 고정

| 항목 | 결정 |
|---|---|
| 팔레트 | 기존 다크 + 신규 라이트 2종 (`:root` + `:root[data-theme="light"]`) |
| 테마 저장 | `members.theme_preference` (로그인 시) + 쿠키 `npo_theme` (비로그인 fallback) |
| 기본값 | 신규 사용자 `'system'` — OS `prefers-color-scheme` 따름 |
| 토글 UI 위치 | donor 헤더 우측 + admin 사이드바 하단 (public은 표시 X) |
| FOUC 방지 | `<head>` 인라인 스크립트로 hydration 전 `data-theme` 주입 |
| 로고 파일 | `public/logo.svg` — 제공 SVG, `#231F20` → `currentColor` 치환 |
| 워드마크 색 | `currentColor` — 테마 적응 |
| 심볼 색 | 브랜드 청록(`#0B7285`, `#0C8599`, `#939597`, `#FEFEFE`) 고정 |
| donor 헤더 | 텍스트 "후원자 마이페이지" 제거 → `[Logo] 에버후원금관리` |
| admin 사이드바 상단 | 로고 + "에버후원금관리" 헤더 |
| public 푸터 | 기존 푸터 하단에 "Powered by [Logo] 에버후원금관리" 링크 (임시 `/` 이동) |
| `app/layout.tsx` 메타 | `title: "에버후원금관리 — NPO 후원관리 플랫폼"` |
| DB 마이그레이션 | 1건 — `members.theme_preference text` |
| 신규 API | 1개 — `POST /api/donor/theme` |
| 신규 컴포넌트 | 3개 — `Logo`, `LogoWithText`, `ThemeToggle` |
| 하드코딩 색 리팩토링 | 본 스펙 범위 — `#ffffff`·`rgba(...)` 리터럴 토큰화 |
| public 테마 토글 | **적용 X** — 기관별 `theme_config` 가 이미 `--bg`/`--accent` 를 덮어씀 |
| 제외 (YAGNI) | 테마별 이미지 자산, 사용자 커스텀 팔레트, admin 전용 preference 저장, public 라이트/다크 전환 |

**접근성**: WCAG 2.1 AA 대비(4.5:1) 준수, `prefers-reduced-motion` 기존 `@media` 블록 유지.

---

## 1. 라이트 팔레트 값

`src/app/globals.css` 의 `:root` 블록은 다크 기본값으로 유지. `:root[data-theme="light"]` 블록을 신규 추가하여 오버라이드.

| 토큰 | 다크 (기존) | 라이트 (신규) | 비고 |
|---|---|---|---|
| `--bg` | `#0a0a0f` | `#fafafb` | 회색빛 흰색 — 눈 피로 경감 |
| `--surface` | `#13131a` | `#ffffff` | 카드는 완전 흰색 |
| `--surface-2` | `#1c1c27` | `#f3f3f7` | 계층 구분 옅은 회색 |
| `--border` | `#2a2a3a` | `#e4e4ec` | 얇고 부드러운 구분선 |
| `--text` | `#f0f0f8` | `#18181f` | 거의 검정, 과하지 않음 |
| `--muted-foreground` | `#8888aa` | `#6b6b80` | AA 대비 통과 |
| `--muted-2` | `#55556a` | `#9a9ab0` | 보조 |
| `--accent` | `#7c3aed` | `#7c3aed` | **브랜드 일관성 — 동일** |
| `--positive` | `#22c55e` | `#16a34a` | 라이트에서 대비 보강 |
| `--negative` | `#ef4444` | `#dc2626` | 라이트에서 대비 보강 |
| `--warning` | `#f59e0b` | `#d97706` | 라이트에서 대비 보강 |
| `--info` | `#38bdf8` | `#0284c7` | 라이트에서 대비 보강 |
| `--accent-soft` | `rgba(124, 58, 237, 0.12)` | `rgba(124, 58, 237, 0.10)` | 라이트에서 약간 연하게 |
| `--positive-soft` | `rgba(34, 197, 94, 0.12)` | `rgba(22, 163, 74, 0.10)` | 동 |
| `--negative-soft` | `rgba(239, 68, 68, 0.12)` | `rgba(220, 38, 38, 0.10)` | 동 |
| `--warning-soft` | `rgba(245, 158, 11, 0.12)` | `rgba(217, 119, 6, 0.10)` | 동 |
| `--info-soft` | `rgba(56, 189, 248, 0.12)` | `rgba(2, 132, 199, 0.10)` | 동 |
| `--shadow-hero` | `rgb(0 0 0 / 0.4)` | `rgb(0 0 0 / 0.08)` | 라이트에서 매우 옅게 |
| `--shadow-card` | `rgb(0 0 0 / 0.08)` | `rgb(0 0 0 / 0.05)` | 라이트에서 더 옅게 |
| `color-scheme` | `dark` | `light` | 브라우저 기본 UI 적응 |

`@theme inline` 블록은 변경 없음(토큰 → var alias만 걸려 있어 자동 적응).

---

## 2. 데이터 계층

### 2.1 마이그레이션 — `supabase/migrations/20260423000001_members_theme_preference.sql`

```sql
ALTER TABLE members
  ADD COLUMN IF NOT EXISTS theme_preference text
    CHECK (theme_preference IN ('light','dark','system'))
    DEFAULT 'system';

COMMENT ON COLUMN members.theme_preference IS
  '후원자 선호 테마. system=OS prefers-color-scheme 따름(기본). light/dark=명시 선택.';
```

- RLS: 기존 `members` 정책으로 충분(donor 본인 UPDATE 가능).
- 인덱스: 없음.
- 기존 사용자: 모두 DEFAULT `'system'` → OS 설정 따름, 영향 없음.

### 2.2 신규 API — `POST /api/donor/theme`

**요청**:
```json
{ "preference": "light" | "dark" | "system" }
```

**응답**: `204 No Content` (응답 body 없음, `Set-Cookie` 헤더 포함)

**에러**:
- `400` — preference 값 무효
- `401` — 세션 없음
- `429` — rate limit 초과 (분당 10회)

**동작**:
1. `getDonorSession()` 확인
2. `UPDATE members SET theme_preference = $1 WHERE id = $member_id`
3. 응답에 `Set-Cookie: npo_theme=<value>; Max-Age=31536000; SameSite=Lax; Path=/` 헤더 포함

**rate limit**: in-memory (`src/lib/rate-limit.ts` 기존 패턴 재사용), member 기준 분당 10회.

### 2.3 쿠키 전략

**이름**: `npo_theme`
**값**: `'light' | 'dark' | 'system'`
**만료**: 1년 (`Max-Age=31536000`)
**속성**: `SameSite=Lax`, `Path=/`, `HttpOnly` 미지정(클라이언트 JS 읽기 필요), `Secure`는 프로덕션(NODE_ENV=production)에서만 설정

클라이언트는 쿠키를 **먼저** 시도, 실패 시 `localStorage.npo_theme` fallback.

### 2.4 FOUC 방지 인라인 스크립트

`src/app/layout.tsx` 의 `<head>` 최상단에 인라인 스크립트 삽입:

```js
(function(){
  try {
    var m = document.cookie.match(/(?:^|;\s*)npo_theme=(light|dark|system)/);
    var pref = m ? m[1] : (localStorage.getItem('npo_theme') || 'system');
    if (pref === 'system') {
      var sysIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', sysIsDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', pref);
    }
  } catch (e) {}
})();
```

- 렌더 블로킹이지만 한 블록으로 FOUC 완전 차단.
- 쿠키가 `'light'|'dark'` 로 명시된 경우, 서버는 `<html data-theme="...">` 를 사전 렌더링하여 스크립트 실행 전에도 올바른 톤으로 첫 페인트.

---

## 3. 로고

### 3.1 SVG 파일 — `public/logo.svg`

제공된 SVG 원본에서 **`fill="#231F20"`** 4개 path 모두 `fill="currentColor"` 로 치환. 다른 색상은 유지.

- 원본 사이즈: `144x40` viewBox 유지.
- 심볼부(원형 청록 + 흰 점): 브랜드 컬러 고정.
- 워드마크("EverPayroll"): `currentColor` → 다크는 흰색 계열, 라이트는 검정 계열 자동 적응.

### 3.2 컴포넌트 — `src/components/brand/logo.tsx`

수기 React 컴포넌트화(SVG→JSX, `@svgr/webpack` 도입 없음).

```tsx
interface LogoProps {
  /** 출력 높이(px). 기본 28. 너비는 비율(144:40) 유지. */
  height?: number;
  /** 워드마크 색. 기본 currentColor. */
  color?: string;
  className?: string;
}

export function Logo({ height = 28, color, className }: LogoProps): JSX.Element
```

- 내부는 inline `<svg>`. `color` prop이 있으면 인라인 `style={{ color }}` 로 지정.
- `aria-label="에버후원금관리"`, `role="img"`.

### 3.3 로고+텍스트 래퍼 — `src/components/brand/logo-with-text.tsx`

```tsx
interface LogoWithTextProps {
  size?: 'sm' | 'md' | 'lg';  // 12/14/16px. 기본 md.
  variant?: 'header' | 'footer' | 'compact';  // 기본 header.
  className?: string;
}

export function LogoWithText({ size, variant, className }: LogoWithTextProps): JSX.Element
```

출력:
- `header`: `[Logo h=28] 에버후원금관리` (가로 배치, gap 8px)
- `footer`: `Powered by [Logo h=20] 에버후원금관리` (가로 배치, 작은 텍스트)
- `compact`: `[Logo h=28]` (텍스트 없음, 모바일 축약)

---

## 4. 테마 토글 컴포넌트 — `src/components/brand/theme-toggle.tsx`

```tsx
interface ThemeToggleProps {
  /** 로그인 사용자면 API 저장, 아니면 쿠키만. 기본 false. */
  persistToServer?: boolean;
  className?: string;
}

export function ThemeToggle({ persistToServer, className }: ThemeToggleProps): JSX.Element
```

**UI**: 3-way 세그먼트 컨트롤 — lucide 아이콘 `Sun` / `Monitor` / `Moon`.

**동작**:
1. 클릭 즉시 `document.documentElement.setAttribute('data-theme', resolved)` — optimistic
   - `'system'` 선택 시 `matchMedia('(prefers-color-scheme: dark)')` 값으로 resolve
2. 쿠키 `npo_theme` 설정, 실패 시 `localStorage.setItem('npo_theme', ...)` fallback
3. `persistToServer=true` 면 `POST /api/donor/theme` 호출
   - 실패 시 UI 되돌리지 않음. `console.warn` 만.
4. `'system'` 선택 시 `matchMedia` 리스너 등록하여 OS 변경 시 `data-theme` 자동 갱신

**현재값 표시**: `document.cookie` / `localStorage` 값을 마운트 시 1회 읽고 state로 저장, 해당 세그먼트 하이라이트.

---

## 5. 적용 위치

### 5.1 `src/app/(donor)/donor/layout.tsx`

변경 전:
```tsx
<a href="/donor">후원자 마이페이지</a>
```

변경 후:
```tsx
<a href="/donor">
  <LogoWithText variant="header" size="md" />
</a>
...
<nav>
  ...
  <ThemeToggle persistToServer={!!session} />
  {session && <UserMenu />}  {/* 기존 로그아웃 form */}
</nav>
```

### 5.2 `src/components/admin/sidebar.tsx`

사이드바 최상단 로고, 최하단 토글 추가.

```tsx
<aside style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
    <LogoWithText variant="header" size="md" />
  </div>
  <nav style={{ flex: 1, overflowY: 'auto' }}>{/* 기존 그룹 */}</nav>
  <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
    <ThemeToggle persistToServer={false} />
  </div>
</aside>
```

- admin은 donor member 세션과 분리되어 있어 `persistToServer=false`(쿠키만). 추후 admin user에도 preference 확장 가능하나 범위 외.

### 5.3 `src/app/(public)/layout.tsx` 푸터 신설

현재 public layout 에는 푸터가 없음. `<PublicNav />`와 `{children}` 아래에 신설한다.

```tsx
<footer className="text-center py-6" style={{ color: 'var(--muted-foreground)' }}>
  <a href="/" className="inline-flex items-center gap-1 text-xs hover:opacity-80">
    <LogoWithText variant="footer" size="sm" />
  </a>
</footer>
```

- 최종 URL: 임시 `/`. 제품 홈페이지 URL 확정 시 교체 (구현 시 환경변수 `NEXT_PUBLIC_BRAND_HOME_URL` 로 뺄 수 있음).
- **테마 상호작용 주의**: public layout 은 이미 기관별 `theme_config` CSS 를 inline `<style>` 태그로 주입하여 `--bg`/`--accent` 등을 덮어씀(기관 브랜드 테마). 따라서 본 스펙의 라이트/다크 토글은 public 페이지에는 적용하지 않으며(토글 UI도 public 에는 표시 X), 로고의 `currentColor` 는 기관 `--muted-foreground` 에 자연스럽게 적응한다.

### 5.4 `src/app/layout.tsx` — 메타 + 초기 테마 주입

```tsx
import { cookies } from 'next/headers';

export const metadata = {
  title: "에버후원금관리 — NPO 후원관리 플랫폼",
  description: "비영리단체를 위한 후원관리 SaaS",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const themeCookie = (await cookies()).get('npo_theme')?.value;
  const initialTheme =
    themeCookie === 'light' || themeCookie === 'dark' ? themeCookie : undefined;

  return (
    <html lang="ko" data-theme={initialTheme}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT_JS}</Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

---

## 6. 하드코딩 색 리팩토링 스윕

라이트 전환 시 깨지는 하드코딩을 본 스펙에서 정리.

| 패턴 | 예시 위치 | 교체 |
|---|---|---|
| `rgba(124, 58, 237, 0.15)` | donor/admin 상태 뱃지 | `var(--accent-soft)` |
| `rgba(245, 158, 11, 0.15)` | payment-list refunded 뱃지 | `var(--warning-soft)` |
| `rgba(34, 197, 94, 0.15)` | positive 뱃지 | `var(--positive-soft)` |
| `rgba(239, 68, 68, 0.15)` | negative 뱃지 | `var(--negative-soft)` |
| `#ffffff` / `#fff` 직접 사용 | primary-foreground 하드코딩 | `var(--primary-foreground)` |
| `rgb(0 0 0 / 0.4)` 그림자 | landing hero | `var(--shadow-hero)` |

**실행 방식**: `grep -rEn "rgba?\(|#(fff|ffffff|000|000000)" src/` 로 후보 나열, 의미 파악 후 토큰 교체. 의미 불명확한 케이스는 스킵하고 PR 설명에 기록.

범위: `src/**/*.{tsx,ts,css}`. 추정 30~50곳.

---

## 7. 에러 처리

| 상황 | 처리 |
|---|---|
| `POST /api/donor/theme` 네트워크/서버 실패 | UI 되돌리지 않음. 쿠키 유지. `console.warn`. |
| 쿠키 쓰기 실패(브라우저 제약) | `localStorage` fallback |
| `data-theme` 속성 훼손 | `:root[data-theme="light"]` 매칭 실패 → 다크(기본) 렌더 |
| SVG 로딩 실패 | inline SVG이므로 런타임 실패 없음 |
| 세션 없음 UPDATE 시도 | 401 응답. 클라이언트는 쿠키만 유지. |

---

## 8. 테스트 계획

### 8.1 단위 테스트

| 파일 | 검증 |
|---|---|
| `tests/unit/theme/api-theme.test.ts` | POST `/api/donor/theme`: 유효값 3종 204, 무효값 400, 세션 없으면 401, rate limit 초과 429, 응답에 `Set-Cookie: npo_theme=...` 포함 |
| `tests/unit/theme/theme-cookie.test.ts` | 쿠키 직렬화/파싱 유틸 (`parseThemePreference`, `serializeThemeCookie`) |

### 8.2 컴포넌트 테스트

**생략**. 프로젝트에 React 컴포넌트 테스트 인프라(RTL/vitest-browser)가 없음. 기존 테스트 관례(순수 TS 단위)와 일관성 유지. 수동 QA로 대체.

### 8.3 수동 QA 체크리스트 (PR 설명에 복사)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 로그아웃 상태에서 donor 홈 → 토글 light 클릭 | 즉시 라이트 전환, 새로고침 후 유지 |
| 2 | 로그인 후 토글 dark → 로그아웃 → 재로그인 | dark 유지 (DB 저장 확인: `SELECT theme_preference FROM members`) |
| 3 | OS를 다크로 설정 + 토글 `system` | 다크 렌더 |
| 4 | OS를 라이트로 변경 (system 모드 중) | 자동 라이트 전환 (matchMedia 리스너) |
| 5 | 첫 방문 (쿠키 없음) + OS 라이트 | 라이트로 초기 렌더 (FOUC 없음) |
| 6 | 첫 방문 + OS 다크 | 다크로 초기 렌더 (FOUC 없음) |
| 7 | donor 헤더 로고 클릭 | `/donor` 이동 |
| 8 | public 캠페인 페이지 푸터 "Powered by 에버후원금관리" 클릭 | `/` 이동 (임시) |
| 9 | admin 사이드바 하단 토글 | admin도 즉시 반영, 쿠키만(DB 저장 없음) |
| 10 | 라이트 테마에서 주요 페이지(donor 홈·약정·납입·영수증·임팩트·admin 회원·결제·캠페인) 시각 확인 | AA 대비 유지, 하드코딩 색 잔존 없음 |
| 11 | 다크 테마에서 동일 페이지 회귀 확인 | 기존 톤 유지 |
| 12 | 모바일 폭(360px) donor 헤더 | 로고 축약/줄바꿈 정상 |
| 13 | Toss 결제 success/fail 페이지 라이트 | 가독성 정상 |
| 14 | 랜딩 빌더 편집 화면 라이트 | 대비 정상 |

### 8.4 회귀 리스크

- 하드코딩 색 리팩토링 스윕(30~50곳) → 시각적 회귀 가능. 체크 #11 필수.
- Toss success/fail / 랜딩 빌더는 donor 영역 밖이므로 QA 범위에 별도 포함.

---

## 9. 마이그레이션 & 배포

### 9.1 배포 순서

1. DB 마이그레이션(`20260423000001_members_theme_preference.sql`) 적용
2. 코드 배포
3. 기존 사용자: `theme_preference='system'` 기본값 → OS 설정 따름, 첫 방문 시 투명
4. 쿠키 미설정 상태 → 인라인 스크립트가 OS 기반 판정

### 9.2 롤백

- DB: 컬럼 추가만이므로 롤백 불필요(남겨둬도 무해)
- 코드: 롤백 시 쿠키가 남아있어도 기존 다크 CSS만 렌더되어 문제없음

---

## 10. 설계 외부 체크리스트

- [ ] 제품 홈페이지 URL 확정 시 `NEXT_PUBLIC_BRAND_HOME_URL` 환경변수 도입 여부 결정
- [ ] 향후 admin user 테마 preference 저장 필요 시 `users.theme_preference` 추가 (범위 외)
- [ ] 기관별 커스텀 브랜딩(멀티테넌트 확장) — 별도 스펙 필요
