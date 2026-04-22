# 테마 토글 + 브랜드 로고 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NPO_S 전역에 다크/라이트 테마 토글(members.theme_preference + 쿠키 + FOUC 방지 인라인 스크립트)과 브랜드 로고(EverPayroll / 에버후원금관리)를 도입한다.

**Architecture:** `:root` + `:root[data-theme="light"]` CSS 변수 오버라이드 + 서버 쿠키(`npo_theme`) 기반 초기 렌더 + 클라이언트 React 컴포넌트(`ThemeToggle`)로 토글. 로고는 inline SVG 컴포넌트(`currentColor` 치환으로 테마 적응).

**Tech Stack:** Next.js 16 App Router, React 19, Supabase (PostgreSQL), Tailwind CSS v4, vitest(단위 테스트), lucide-react(아이콘).

---

## 파일 구조

**Create:**

- `supabase/migrations/20260423000001_members_theme_preference.sql` — DB 컬럼
- `public/logo.svg` — 브랜드 SVG(currentColor 치환)
- `src/lib/theme/preference.ts` — 쿠키 파싱/직렬화 유틸
- `src/app/api/donor/theme/route.ts` — POST 엔드포인트
- `src/components/brand/logo.tsx` — inline SVG React 컴포넌트
- `src/components/brand/logo-with-text.tsx` — 로고+한글 래퍼
- `src/components/brand/theme-toggle.tsx` — 3-way 세그먼트 토글
- `tests/unit/theme/preference.test.ts` — 쿠키 유틸 테스트
- `tests/unit/theme/api-theme.test.ts` — API 테스트

**Modify:**

- `src/app/globals.css` — 라이트 팔레트 블록 추가
- `src/app/layout.tsx` — 메타타이틀 변경 + 쿠키 기반 data-theme 초기값 + FOUC 방지 인라인 스크립트
- `src/app/(donor)/donor/layout.tsx` — 로고 + 테마 토글 적용
- `src/components/admin/sidebar.tsx` — 상단 로고 + 하단 토글 추가
- `src/app/(public)/layout.tsx` — 푸터 신설

**하드코딩 색 리팩토링 (별도 Task로 묶음)**: grep으로 후보 나열 후 토큰 교체.

---

## Task 1: DB 마이그레이션 — `members.theme_preference`

**Files:**

- Create: `supabase/migrations/20260423000001_members_theme_preference.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- Phase Theme-A: members.theme_preference 컬럼 추가
-- donor 본인이 선호하는 테마를 기기 간 동기화. NULL 대신 default 'system'으로
-- OS prefers-color-scheme 따름을 명시.

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS theme_preference text
    CHECK (theme_preference IN ('light','dark','system'))
    DEFAULT 'system';

COMMENT ON COLUMN members.theme_preference IS
  '후원자 선호 테마. system=OS prefers-color-scheme 따름(기본). light/dark=명시 선택.';
```

- [ ] **Step 2: 원격 Supabase에 적용**

Run: Supabase MCP `apply_migration` 또는 `npx supabase db push` — 프로젝트 관례에 따름. 로컬 개발 시 `npx supabase migration up`.

Expected: `members` 테이블에 `theme_preference` 컬럼 추가됨.

- [ ] **Step 3: 검증**

Run: `SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name='members' AND column_name='theme_preference'`
Expected: `theme_preference | text | 'system'::text`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000001_members_theme_preference.sql
git commit -m "feat(db): members.theme_preference 컬럼 추가

다크/라이트 테마 선호 저장용. CHECK 제약으로 light/dark/system
3택. DEFAULT 'system'으로 OS 설정 따름을 기본값으로.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 쿠키 파싱/직렬화 유틸 + 테스트

**Files:**

- Create: `src/lib/theme/preference.ts`
- Create: `tests/unit/theme/preference.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/theme/preference.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  parseThemePreference,
  serializeThemeCookie,
  THEME_COOKIE_NAME,
} from '@/lib/theme/preference';

describe('parseThemePreference', () => {
  it('returns "light" for valid light', () => {
    expect(parseThemePreference('light')).toBe('light');
  });

  it('returns "dark" for valid dark', () => {
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('returns "system" for valid system', () => {
    expect(parseThemePreference('system')).toBe('system');
  });

  it('returns null for invalid value', () => {
    expect(parseThemePreference('purple')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseThemePreference(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseThemePreference('')).toBeNull();
  });
});

describe('serializeThemeCookie', () => {
  it('builds cookie string with all required attributes', () => {
    const out = serializeThemeCookie('light', { isProduction: true });
    expect(out).toContain('npo_theme=light');
    expect(out).toContain('Max-Age=31536000');
    expect(out).toContain('SameSite=Lax');
    expect(out).toContain('Path=/');
    expect(out).toContain('Secure');
  });

  it('omits Secure in non-production', () => {
    const out = serializeThemeCookie('dark', { isProduction: false });
    expect(out).toContain('npo_theme=dark');
    expect(out).not.toContain('Secure');
  });

  it('never sets HttpOnly (client must read)', () => {
    const out = serializeThemeCookie('system', { isProduction: true });
    expect(out).not.toContain('HttpOnly');
  });
});

describe('THEME_COOKIE_NAME', () => {
  it('is "npo_theme"', () => {
    expect(THEME_COOKIE_NAME).toBe('npo_theme');
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test -- tests/unit/theme/preference.test.ts`
Expected: FAIL — `Cannot find module '@/lib/theme/preference'`

- [ ] **Step 3: 최소 구현**

`src/lib/theme/preference.ts`:

```ts
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE_NAME = 'npo_theme';
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년

const VALID: ReadonlyArray<ThemePreference> = ['light', 'dark', 'system'];

export function parseThemePreference(value: string | undefined | null): ThemePreference | null {
  if (!value) return null;
  return (VALID as readonly string[]).includes(value) ? (value as ThemePreference) : null;
}

export function serializeThemeCookie(
  value: ThemePreference,
  opts: { isProduction: boolean }
): string {
  const parts = [
    `${THEME_COOKIE_NAME}=${value}`,
    `Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (opts.isProduction) parts.push('Secure');
  return parts.join('; ');
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/unit/theme/preference.test.ts`
Expected: PASS — 10 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/theme/preference.ts tests/unit/theme/preference.test.ts
git commit -m "feat(theme): 테마 preference 쿠키 유틸

parseThemePreference/serializeThemeCookie + 상수.
HttpOnly 절대 미지정(클라이언트 JS 읽기 필요), 프로덕션에서만
Secure. 10개 단위 테스트.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: POST /api/donor/theme 엔드포인트 + 테스트

**Files:**

- Create: `src/app/api/donor/theme/route.ts`
- Create: `tests/unit/theme/api-theme.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/theme/api-theme.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ getDonorSession: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));

import { POST } from '@/app/api/donor/theme/route';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

function buildReq(body: unknown): Request {
  return new Request('http://localhost/api/donor/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSupabaseUpdateOk() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, update, eq };
}

beforeEach(() => {
  vi.resetAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    allowed: true, remaining: 9, retryAfterMs: 0,
  });
});

describe('POST /api/donor/theme', () => {
  it('returns 401 when no session', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid preference value', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({ preference: 'purple' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing preference field', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 204 with Set-Cookie header on success (light)', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toMatch(/npo_theme=light/);
  });

  it('accepts all 3 valid values', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    for (const v of ['light', 'dark', 'system']) {
      mockSupabaseUpdateOk();
      const res = await POST(buildReq({ preference: v }));
      expect(res.status).toBe(204);
    }
  });

  it('returns 429 when rate limit exceeded', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: false, remaining: 0, retryAfterMs: 30_000,
    });
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for malformed JSON', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    const req = new Request('http://localhost/api/donor/theme', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when DB update fails', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    const eq = vi.fn().mockResolvedValue({ error: { message: 'db down' } });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: 테스트 실행해서 실패 확인**

Run: `npm test -- tests/unit/theme/api-theme.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/donor/theme/route'`

- [ ] **Step 3: 최소 구현**

`src/app/api/donor/theme/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';
import { parseThemePreference, serializeThemeCookie } from '@/lib/theme/preference';

export async function POST(req: Request): Promise<Response> {
  const session = await getDonorSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = rateLimit(`theme:${session.member.id}`, 10, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const preference = parseThemePreference(
    typeof body === 'object' && body !== null && 'preference' in body
      ? String((body as { preference: unknown }).preference)
      : undefined,
  );
  if (!preference) {
    return NextResponse.json({ error: 'Invalid preference' }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('members')
    .update({ theme_preference: preference })
    .eq('id', session.member.id);
  if (error) {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }

  const cookie = serializeThemeCookie(preference, {
    isProduction: process.env.NODE_ENV === 'production',
  });
  return new NextResponse(null, {
    status: 204,
    headers: { 'Set-Cookie': cookie },
  });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- tests/unit/theme/api-theme.test.ts`
Expected: PASS — 8 tests passed.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/donor/theme/route.ts tests/unit/theme/api-theme.test.ts
git commit -m "feat(api): POST /api/donor/theme

테마 preference 저장 엔드포인트. 유효값 3종 수락, 무효 400,
세션 없음 401, rate limit(분당 10회) 초과 429, DB 실패 500.
응답 204 + Set-Cookie: npo_theme=...

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 라이트 팔레트 CSS

**Files:**

- Modify: `src/app/globals.css`

- [ ] **Step 1: `:root` 블록 아래에 라이트 오버라이드 블록 추가**

`src/app/globals.css` 의 첫 번째 `:root { ... }` 블록이 끝나는 닫는 중괄호 **다음 줄에** 다음 블록 삽입:

```css
/* ===== 라이트 테마 오버라이드 (Phase Theme-A) ===== */
:root[data-theme="light"] {
  --bg:        #fafafb;
  --surface:   #ffffff;
  --surface-2: #f3f3f7;
  --border:    #e4e4ec;
  --text:      #18181f;
  --muted:     var(--surface-2);
  --muted-2:   #9a9ab0;

  --accent:    #7c3aed;
  --positive:  #16a34a;
  --negative:  #dc2626;
  --warning:   #d97706;
  --info:      #0284c7;

  --accent-soft:   rgba(124, 58, 237, 0.10);
  --positive-soft: rgba(22, 163, 74, 0.10);
  --negative-soft: rgba(220, 38, 38, 0.10);
  --warning-soft:  rgba(217, 119, 6, 0.10);
  --info-soft:     rgba(2, 132, 199, 0.10);

  --muted-foreground: #6b6b80;

  --shadow-hero: 0 20px 60px -20px rgb(0 0 0 / 0.08);
  --shadow-card: 0 4px 20px -4px rgb(0 0 0 / 0.05);

  color-scheme: light;
}
```

- [ ] **Step 2: 빌드 검증**

Run: `npm run build`
Expected: 에러 없이 빌드 성공.

- [ ] **Step 3: 수동 확인 — 개발 서버에서 devtools로 라이트 테마 강제 적용**

Run: `npm run dev`

브라우저에서 `/donor` 접속 → devtools Elements 탭에서 `<html>` 에 `data-theme="light"` 속성 추가.

Expected: 배경이 흰색 계열로, 텍스트가 검정 계열로 전환.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): 라이트 팔레트 CSS 추가

:root[data-theme=\"light\"] 블록으로 --bg/--surface/--text 등
15개 토큰 오버라이드. --accent는 브랜드 일관성 위해 동일 유지.
--positive/negative/warning/info는 라이트에서 대비 보강.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: 로고 SVG 파일 + Logo 컴포넌트

**Files:**

- Create: `public/logo.svg`
- Create: `src/components/brand/logo.tsx`

- [ ] **Step 1: logo.svg 파일 작성 (currentColor 치환)**

`public/logo.svg` 파일을 작성한다. 원본 SVG 마크업은 사용자가 제공한 그대로 사용하되, **`fill="#231F20"` 4개 중 워드마크 관련 2개 path** 를 `fill="currentColor"` 로 치환. 심볼부 색(`#939597`, `#FEFEFE`, `#0C8599`, `#0B7285`)은 유지.

치환 대상:
- 62.47V11.525 로 시작하는 path (라틴 문자 워드마크 일부) → `currentColor`
- 127.16 24.755 로 시작하는 path (라틴 문자 워드마크 일부) → `currentColor`

원본의 첫 5개 path(원형 심볼)는 그대로.

- [ ] **Step 2: Logo 컴포넌트 작성**

`src/components/brand/logo.tsx`:

```tsx
interface LogoProps {
  /** 출력 높이(px). 기본 28. 너비는 비율(144:40) 유지. */
  height?: number;
  /** 워드마크 색. 기본 currentColor. */
  color?: string;
  className?: string;
}

const ASPECT = 144 / 40;

export function Logo({ height = 28, color, className }: LogoProps) {
  const width = Math.round(height * ASPECT);
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 144 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="에버후원금관리"
      className={className}
      style={color ? { color } : undefined}
    >
      <g>
        {/* 원형 회색 테두리 */}
        <path fillRule="evenodd" clipRule="evenodd" d="M20 0.5C9.25 0.5 0.5 9.25 0.5 20C0.5 30.75 9.24 39.5 20 39.5C30.76 39.5 39.49 30.76 39.49 20C39.49 9.24 30.75 0.5 20 0.5ZM20 40C8.97 40 0 31.03 0 20C0 8.97 8.97 0 20 0C31.03 0 40 8.97 40 20C40 31.03 31.03 40 20 40Z" fill="#939597"/>
        {/* 작은 점 (흰색) */}
        <path fillRule="evenodd" clipRule="evenodd" d="M39 6.5C39 8.99 36.98 11 34.5 11C32.02 11 30 8.99 30 6.5C30 4.02 32.01 2 34.5 2C36.99 2 39 4.02 39 6.5Z" fill="#FEFEFE"/>
        {/* 작은 점 (청록) */}
        <path fillRule="evenodd" clipRule="evenodd" d="M38 6.5C38 8.43 36.43 10 34.5 10C32.57 10 31 8.43 31 6.5C31 4.57 32.57 3 34.5 3C36.43 3 38 4.57 38 6.5Z" fill="#0C8599"/>
        {/* 큰 원 (어두운 청록) */}
        <path fillRule="evenodd" clipRule="evenodd" d="M35 20C35 28.28 28.28 35 20 35C11.72 35 5 28.28 5 20C5 11.72 11.71 5 20 5C28.29 5 35 11.72 35 20Z" fill="#0B7285"/>
        {/* 큰 원 (청록) */}
        <path fillRule="evenodd" clipRule="evenodd" d="M20 34C12.27 34 6 27.73 6 20C6 12.27 12.27 6 20 6C27.73 6 34 12.27 34 20C34 27.73 27.73 34 20 34Z" fill="#0C8599"/>
        {/* 워드마크 1 — currentColor */}
        <path fillRule="evenodd" clipRule="evenodd" d="M62.47 8.995V11.525H63.38V30.995H65.78C65.9 30.325 65.95 29.485 65.95 28.485V8.995H62.46H62.47ZM57.32 8.995V11.525H59.5V16.695H58.13C57.88 15.375 57.29 14.275 56.34 13.395C55.39 12.515 54.32 12.085 53.12 12.085C51.73 12.085 50.53 12.655 49.52 13.785C48.51 14.915 48 16.275 48 17.845C48 19.415 48.51 20.775 49.52 21.895C50.53 23.015 51.73 23.585 53.12 23.585C54.35 23.585 55.44 23.135 56.4 22.225C57.36 21.315 57.94 20.185 58.14 18.825H59.48V31.005H61.89C62.01 30.335 62.06 29.495 62.06 28.495V8.995H57.3H57.32ZM54.87 20.415C54.4 21.125 53.82 21.475 53.13 21.475C52.44 21.475 51.85 21.125 51.39 20.415C50.92 19.705 50.68 18.845 50.68 17.845C50.68 16.845 50.92 15.975 51.39 15.265C51.86 14.545 52.44 14.185 53.13 14.185C53.82 14.185 54.41 14.545 54.87 15.265C55.34 15.985 55.58 16.845 55.58 17.845C55.58 18.845 55.34 19.705 54.87 20.415ZM112.25 12.085C110.68 12.085 109.32 12.695 108.2 13.915C107.07 15.135 106.51 16.595 106.51 18.275C106.51 19.955 107.07 21.415 108.2 22.615C109.33 23.815 110.68 24.425 112.25 24.425C113.82 24.425 115.18 23.825 116.31 22.615C117.44 21.415 118.01 19.965 118.01 18.275C118.01 16.585 117.44 15.135 116.31 13.915C115.18 12.695 113.82 12.085 112.25 12.085ZM114.41 21.175C113.84 21.945 113.12 22.325 112.25 22.325C111.38 22.325 110.68 21.945 110.11 21.175C109.53 20.415 109.24 19.445 109.24 18.285C109.24 17.125 109.53 16.145 110.11 15.365C110.69 14.585 111.4 14.195 112.25 14.195C113.1 14.195 113.82 14.585 114.39 15.365C114.97 16.145 115.26 17.115 115.26 18.285C115.26 19.455 114.98 20.415 114.41 21.175ZM95.14 14.215H96.55V12.085H86.91V14.215H88.3V22.205H86.92V24.305H96.89V22.205H95.15V14.215H95.14ZM90.83 22.205H92.61V14.215H90.83V22.205Z" fill="currentColor"/>
        {/* 워드마크 2 — currentColor */}
        <path fillRule="evenodd" clipRule="evenodd" d="M127.16 24.755H138.32V25.805H127.16V30.255C127.16 30.465 127.23 30.635 127.37 30.785C127.51 30.925 127.66 31.005 127.83 31.005H141.16V28.925H129.87V27.775H141.16V22.315H127.16V24.755ZM135.56 19.325V17.795H141.28V15.715H129.91V14.615H141.17V8.995H127.2V11.525H138.44V12.655H127.2V17.055C127.2 17.265 127.27 17.435 127.4 17.575C127.54 17.715 127.69 17.795 127.86 17.795H132.8V19.325H125.4V21.455H143.01V19.325H135.55H135.56ZM80.63 8.995V11.525H82.62V15.935H79.01V14.105V11.575H74.29V14.105H76.29V15.935H71.72V11.575H67V14.105H69.01V23.565C69.01 23.755 69.08 23.925 69.21 24.075C69.35 24.225 69.5 24.305 69.67 24.305H78.99V18.065H82.6V31.005H85.16C85.27 30.335 85.33 29.495 85.33 28.495V8.995H80.61H80.63ZM71.73 22.195H76.3V18.055H71.73V22.195ZM101.34 8.995V11.525H102.24V30.995H104.63C104.75 30.325 104.8 29.485 104.8 28.485V8.995H101.34ZM118.71 8.995V11.525H120.7V30.995H123.26C123.37 30.325 123.43 29.485 123.43 28.485V8.995H118.71ZM96.23 8.995V11.525H98.39V16.055H96.31V18.185H98.39V31.005H100.78C100.89 30.335 100.95 29.495 100.95 28.495V8.995H96.23Z" fill="currentColor"/>
      </g>
    </svg>
  );
}
```

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 4: Commit**

```bash
git add public/logo.svg src/components/brand/logo.tsx
git commit -m "feat(brand): Logo 컴포넌트 + SVG 파일

원본 SVG 의 #231F20 워드마크 2개 path를 currentColor로 치환,
심볼부 청록색은 브랜드 컬러로 유지. height prop로 크기 제어,
color prop 으로 외부 override 가능.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: LogoWithText 래퍼

**Files:**

- Create: `src/components/brand/logo-with-text.tsx`

- [ ] **Step 1: 구현**

`src/components/brand/logo-with-text.tsx`:

```tsx
import { Logo } from './logo';

interface LogoWithTextProps {
  size?: 'sm' | 'md' | 'lg';
  variant?: 'header' | 'footer' | 'compact';
  className?: string;
}

const LOGO_HEIGHT: Record<NonNullable<LogoWithTextProps['size']>, number> = {
  sm: 20,
  md: 28,
  lg: 36,
};

const TEXT_SIZE_PX: Record<NonNullable<LogoWithTextProps['size']>, number> = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function LogoWithText({
  size = 'md',
  variant = 'header',
  className,
}: LogoWithTextProps) {
  const logoHeight = LOGO_HEIGHT[size];
  const textSize = TEXT_SIZE_PX[size];

  if (variant === 'compact') {
    return (
      <span className={className} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <Logo height={logoHeight} />
      </span>
    );
  }

  const showPowered = variant === 'footer';

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontSize: textSize,
        fontWeight: 600,
      }}
    >
      {showPowered && (
        <span style={{ fontWeight: 400, color: 'var(--muted-foreground)' }}>
          Powered by
        </span>
      )}
      <Logo height={logoHeight} />
      <span>에버후원금관리</span>
    </span>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 3: Commit**

```bash
git add src/components/brand/logo-with-text.tsx
git commit -m "feat(brand): LogoWithText 래퍼 컴포넌트

header/footer/compact 3가지 variant, sm/md/lg 3가지 size.
footer variant는 'Powered by' 접두 표시. 한글 '에버후원금관리'
병기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: ThemeToggle 컴포넌트

**Files:**

- Create: `src/components/brand/theme-toggle.tsx`

- [ ] **Step 1: 구현**

`src/components/brand/theme-toggle.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import {
  THEME_COOKIE_NAME,
  THEME_COOKIE_MAX_AGE_SECONDS,
  type ThemePreference,
} from '@/lib/theme/preference';

interface ThemeToggleProps {
  persistToServer?: boolean;
  className?: string;
}

function readCurrentPreference(): ThemePreference {
  if (typeof document === 'undefined') return 'system';
  const m = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${THEME_COOKIE_NAME}=(light|dark|system)`),
  );
  if (m) return m[1] as ThemePreference;
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(THEME_COOKIE_NAME) : null;
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored;
  return 'system';
}

function resolveTheme(pref: ThemePreference): 'light' | 'dark' {
  if (pref === 'system') {
    const isDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? 'dark' : 'light';
  }
  return pref;
}

function writeCookie(value: ThemePreference, isProduction: boolean): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const secure = isProduction ? '; Secure' : '';
    document.cookie = `${THEME_COOKIE_NAME}=${value}; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
    return true;
  } catch {
    return false;
  }
}

function writeLocalStorage(value: ThemePreference): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_COOKIE_NAME, value);
    }
  } catch {
    // silent
  }
}

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'light', label: '라이트 테마', Icon: Sun },
  { value: 'system', label: 'OS 설정 따르기', Icon: Monitor },
  { value: 'dark', label: '다크 테마', Icon: Moon },
];

export function ThemeToggle({ persistToServer = false, className }: ThemeToggleProps) {
  const [current, setCurrent] = useState<ThemePreference>('system');

  useEffect(() => {
    setCurrent(readCurrentPreference());
  }, []);

  useEffect(() => {
    if (current !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [current]);

  async function apply(pref: ThemePreference) {
    setCurrent(pref);
    const resolved = resolveTheme(pref);
    document.documentElement.setAttribute('data-theme', resolved);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOk = writeCookie(pref, isProduction);
    if (!cookieOk) writeLocalStorage(pref);

    if (persistToServer) {
      try {
        await fetch('/api/donor/theme', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ preference: pref }),
        });
      } catch (e) {
        console.warn('[theme-toggle] server persist failed', e);
      }
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label="테마 선택"
      className={className}
      style={{
        display: 'inline-flex',
        gap: 2,
        padding: 2,
        borderRadius: 6,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            onClick={() => apply(value)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 4,
              border: 'none',
              cursor: 'pointer',
              background: active ? 'var(--surface)' : 'transparent',
              color: active ? 'var(--accent)' : 'var(--muted-foreground)',
              boxShadow: active ? '0 1px 2px rgb(0 0 0 / 0.05)' : undefined,
              transition: 'background 0.15s, color 0.15s',
            }}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 빌드 확인**

Run: `npm run build`
Expected: 성공. `lucide-react`는 이미 프로젝트에 포함.

- [ ] **Step 3: Commit**

```bash
git add src/components/brand/theme-toggle.tsx
git commit -m "feat(brand): ThemeToggle 3-way 세그먼트 컴포넌트

Sun/Monitor/Moon 라디오 그룹. 클릭 시 즉시 data-theme 반영
(optimistic), 쿠키 저장 → localStorage fallback → persistToServer
옵션 시 POST /api/donor/theme. system 모드에서 OS 변경 matchMedia
리스너로 자동 반영.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Root layout 메타 + FOUC 방지 스크립트 + data-theme 초기값

**Files:**

- Modify: `src/app/layout.tsx`

- [ ] **Step 1: 기존 layout 확인**

Run: `cat src/app/layout.tsx`
Expected: 기존 `metadata` 와 `RootLayout` 확인. 다른 import(폰트 로더 등)가 있으면 보존 필요.

- [ ] **Step 2: 수정**

`src/app/layout.tsx` 전체를 다음으로 교체 (기존 폰트/setup 코드가 있으면 병합):

```tsx
import type { Metadata } from 'next';
import Script from 'next/script';
import { cookies } from 'next/headers';
import { parseThemePreference, THEME_COOKIE_NAME } from '@/lib/theme/preference';
import './globals.css';

export const metadata: Metadata = {
  title: '에버후원금관리 — NPO 후원관리 플랫폼',
  description: '비영리단체를 위한 후원관리 SaaS',
};

const THEME_INIT_JS = `(function(){
  try {
    var m = document.cookie.match(/(?:^|;\\s*)npo_theme=(light|dark|system)/);
    var pref = m ? m[1] : (window.localStorage && localStorage.getItem('npo_theme')) || 'system';
    if (pref === 'system') {
      var sysIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', sysIsDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', pref);
    }
  } catch (e) {}
})();`;

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const themeCookieRaw = (await cookies()).get(THEME_COOKIE_NAME)?.value;
  const pref = parseThemePreference(themeCookieRaw);
  const initialTheme = pref === 'light' || pref === 'dark' ? pref : undefined;

  return (
    <html lang="ko" data-theme={initialTheme}>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_JS}
        </Script>
      </head>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: 빌드 + dev 서버 확인**

Run: `npm run dev`

브라우저 검사:
1. 쿠키 없는 상태 + OS 다크 → `<html data-theme="dark">` (스크립트 주입)
2. OS 라이트 + 쿠키 없음 → `<html data-theme="light">`
3. `document.cookie = "npo_theme=light; path=/"` 수동 설정 후 새로고침 → `<html data-theme="light">` (서버 SSR)

Expected: FOUC 없음, 첫 페인트에서 올바른 톤.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(theme): Root layout 메타 + FOUC 방지 초기화

제품명 '에버후원금관리'로 메타 타이틀 변경. 쿠키 기반 data-theme
서버 렌더 주입 + beforeInteractive 스크립트로 system 모드/OS 판정.
FOUC 없이 첫 페인트에서 올바른 톤.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Donor 헤더에 로고 + 테마 토글

**Files:**

- Modify: `src/app/(donor)/donor/layout.tsx`

- [ ] **Step 1: 기존 헤더 교체**

`src/app/(donor)/donor/layout.tsx` 의 `<a href="/donor" ...>후원자 마이페이지</a>` 를 `<LogoWithText>` 로 교체하고, 우측 nav에 `<ThemeToggle>` 추가.

```tsx
import { getDonorSession } from "@/lib/auth";
import { logoutDonor } from "./actions";
import { DonorNav } from "@/components/donor/donor-nav";
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";

export default async function DonorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getDonorSession();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <header
        style={{
          height: 56,
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
          display: "flex",
          alignItems: "center",
          padding: "0 1rem",
        }}
      >
        <a
          href="/donor"
          style={{
            color: "var(--text)",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <LogoWithText variant="header" size="md" />
        </a>
        {session && <DonorNav />}
        <nav
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <ThemeToggle persistToServer={!!session} />
          {session ? (
            <>
              <span style={{ color: "var(--muted-foreground)", fontSize: 14 }}>
                {session.member.name}님
              </span>
              <form action={logoutDonor}>
                <button
                  type="submit"
                  style={{
                    color: "var(--muted-foreground)",
                    fontSize: 14,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  로그아웃
                </button>
              </form>
            </>
          ) : (
            <a
              href="/donor/login"
              style={{
                color: "var(--muted-foreground)",
                fontSize: 14,
                textDecoration: "none",
              }}
            >
              로그인
            </a>
          )}
        </nav>
      </header>
      <main
        style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "2rem 1rem",
        }}
      >
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: dev 서버 수동 확인**

Run: `npm run dev`, `/donor` 접속

Expected:
- 헤더 좌측: 로고 + "에버후원금관리"
- 헤더 우측: 테마 토글 + (로그인) 이름 + 로그아웃 / (비로그인) 로그인

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(donor)/donor/layout.tsx'
git commit -m "feat(donor): 헤더에 로고 + 테마 토글 적용

'후원자 마이페이지' 텍스트 제거 → LogoWithText(header) 교체.
nav 우측에 ThemeToggle 추가, 로그인 사용자는 persistToServer=true로
DB 저장.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Admin 사이드바에 로고 + 테마 토글

**Files:**

- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: import 추가**

`src/components/admin/sidebar.tsx` 상단 import 섹션에 추가:

```tsx
import { LogoWithText } from "@/components/brand/logo-with-text";
import { ThemeToggle } from "@/components/brand/theme-toggle";
```

- [ ] **Step 2: 사이드바 구조 확인 후 마크업 삽입**

Run: `head -200 src/components/admin/sidebar.tsx`

`AdminSidebar` 반환 JSX 에서 **가장 바깥 컨테이너** (`<aside>` 혹은 `<div>`) 내부:

- **맨 위** — 기존 nav 그룹 맵핑 "앞" 에 로고 박스:
  ```tsx
  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)' }}>
    <LogoWithText variant="header" size="md" />
  </div>
  ```
- **맨 아래** — 로그아웃 form 또는 nav 끝 "뒤" 에 토글 박스:
  ```tsx
  <div style={{
    padding: '1rem',
    borderTop: '1px solid var(--border)',
    marginTop: 'auto',
  }}>
    <ThemeToggle persistToServer={false} />
  </div>
  ```

`marginTop: 'auto'` 가 먹으려면 컨테이너에 `display: flex; flex-direction: column; height: 100vh` 스타일이 있어야 함. 없으면 추가.

- [ ] **Step 3: dev 서버 수동 확인**

Run: `npm run dev`, `/admin` 접속

Expected:
- 사이드바 최상단: 로고 + "에버후원금관리"
- 사이드바 최하단: 테마 토글
- 토글 클릭 시 admin 전체 테마 전환

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/sidebar.tsx
git commit -m "feat(admin): 사이드바에 로고 + 테마 토글 추가

사이드바 최상단 LogoWithText(header), 최하단 ThemeToggle
(persistToServer=false — admin은 쿠키만). 기존 NAV 그룹 유지.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Public 푸터 신설

**Files:**

- Modify: `src/app/(public)/layout.tsx`

- [ ] **Step 1: import 추가 + footer 마크업 삽입**

`src/app/(public)/layout.tsx`:

import 섹션 최상단에 추가:

```tsx
import { LogoWithText } from "@/components/brand/logo-with-text";
```

기존 JSX 의 `{children}` **바로 다음 줄** 에 footer 삽입 (기존 `<style>` 태그, `<PublicNav />`, 기관 theme_config 로직은 모두 유지):

```tsx
<footer
  style={{
    textAlign: 'center',
    padding: '1.5rem 1rem',
    color: 'var(--muted-foreground)',
    fontSize: 12,
  }}
>
  <a
    href="/"
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      textDecoration: 'none',
      color: 'inherit',
    }}
  >
    <LogoWithText variant="footer" size="sm" />
  </a>
</footer>
```

즉 **기존 layout 본문 반환값 구조**:

```
<div>
  {기존 style 태그}
  <PublicNav />
  {children}
  {신규 footer ↑}
</div>
```

- [ ] **Step 2: dev 서버 수동 확인**

Run: `npm run dev`, `/` 또는 `/campaigns/<slug>` 접속

Expected: 페이지 하단에 "Powered by [로고] 에버후원금관리" 가운데 정렬.

- [ ] **Step 3: Commit**

```bash
git add 'src/app/(public)/layout.tsx'
git commit -m "feat(public): 푸터 신설 — 'Powered by 에버후원금관리'

public layout 하단 footer 추가. 기관 theme_config는 기존 동작
유지, footer 텍스트만 currentColor로 기관 톤 적응. 임시 href='/'.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: 하드코딩 색 리팩토링 스윕

**Files:** (여러 파일, grep 결과 기반)

- [ ] **Step 1: 후보 나열**

Grep 도구로 다음 패턴 검색:

- `rgba\((124|245|34|239|56),`
- `rgb\(0 0 0 / 0\.`

범위: `src/**/*.{tsx,ts}`.

Expected: 문자열 리터럴 위치 리스트 약 20~50건.

- [ ] **Step 2: 각 파일 검토하여 토큰 교체**

교체 맵:

| 원본 | 토큰 |
|---|---|
| `rgba(124, 58, 237, 0.15)` / `0.12` | `var(--accent-soft)` |
| `rgba(245, 158, 11, 0.15)` / `0.12` | `var(--warning-soft)` |
| `rgba(34, 197, 94, 0.15)` / `0.12` | `var(--positive-soft)` |
| `rgba(239, 68, 68, 0.15)` / `0.12` | `var(--negative-soft)` |
| `rgba(56, 189, 248, 0.15)` / `0.12` | `var(--info-soft)` |

의미 불명확한 케이스(예: 애니메이션에서 특정 alpha 요구, 브랜드 그라디언트)는 **건드리지 말고 기록**.

- [ ] **Step 3: 빌드 확인**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 4: 양쪽 테마 시각 확인**

Run: `npm run dev`

주요 페이지(donor 홈·약정·납입·영수증·임팩트, admin 회원·결제·캠페인, public 캠페인, Toss success/fail, landing 빌더) 에서 라이트/다크 양쪽 토글 → 하드코딩 색 잔존 없는지 시각 확인.

- [ ] **Step 5: Commit**

```bash
git add -u src/
git commit -m "refactor(theme): 하드코딩 색 리터럴 토큰화

rgba(124,58,237,...) 등 --accent/warning/positive/negative/info
계열 하드코딩을 var(--*-soft) 토큰으로 교체. 라이트/다크 양쪽에서
일관된 대비 유지. 의미 불명확한 리터럴은 미변경.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 전체 테스트 + 수동 QA

**Files:** (없음)

- [ ] **Step 1: 전체 단위 테스트**

Run: `npm test`
Expected: 전체 PASS. 기존 194 + 신규 ~18 ≈ 212 passing.

- [ ] **Step 2: 타입체크**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 프로덕션 빌드**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 4: 수동 QA 체크리스트 (Spec §8.3, 14개 시나리오)**

스펙 `docs/2026-04-22-theme-toggle-and-logo-design.md` §8.3 의 14개 체크를 모두 수행.

주요:

1. 로그아웃 donor 홈 → 토글 light → 새로고침 유지
2. 로그인 후 dark → 로그아웃 → 재로그인 → dark 유지
3. OS 다크 + system → 다크
4. system 중 OS 라이트 전환 → 자동 라이트
5. 첫 방문(쿠키 없음) + OS 라이트 → 라이트 초기 렌더(FOUC 없음)
6. 첫 방문 + OS 다크 → 다크 초기 렌더
7. donor 로고 클릭 → `/donor`
8. public 푸터 로고 → `/`
9. admin 토글 → 즉시 반영, DB 저장 없음
10. 라이트 주요 페이지 대비
11. 다크 회귀
12. 모바일 360px donor 헤더
13. Toss success/fail 라이트
14. landing 빌더 라이트

- [ ] **Step 5: (옵션) QA 피드백 반영 후 Commit**

```bash
# 수동 QA 중 수정 필요 발견 시:
git add -u
git commit -m "chore(theme): QA 피드백 반영

<상세>

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## 구현 완료 기준

- 모든 Task 1-13 체크박스 완료
- `npm test` 전체 PASS
- `npm run build` 성공
- Spec §8.3 수동 QA 14개 항목 확인
- git log 에 기능별로 분리된 커밋 (Task 별 1~2 커밋)
