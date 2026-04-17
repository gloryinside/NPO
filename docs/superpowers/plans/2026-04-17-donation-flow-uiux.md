# Sub-1: 후원 플로우 UI/UX 고도화 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기관별 테마 커스터마이징 + 위저드/레거시 폼 디자인 고도화 + 공유 컴포넌트 추출 + 메인 페이지 개선

**Architecture:** `orgs.theme_config` JSONB로 기관별 CSS 변수 오버라이드. 공유 UI 컴포넌트(`AmountSelector`, `PayMethodSelector`, `DonationTypeToggle`)를 `src/components/public/donation/`에 추출하여 위저드와 레거시 폼이 동일 컴포넌트를 재사용. 위저드 3스텝은 기존 구조 유지하되 UI만 고도화.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Supabase, Zod, CSS 변수 기반 테마

**Spec:** `docs/superpowers/specs/2026-04-17-donation-flow-uiux-design.md`

---

## File Structure

### 신규 파일
| 파일 | 역할 |
|------|------|
| `supabase/migrations/20260417100001_org_theme_config.sql` | `orgs.theme_config JSONB` 컬럼 추가 |
| `src/lib/theme/config.ts` | `ThemeConfig` 타입, 기본값, CSS 변수 변환 함수 |
| `src/app/api/admin/settings/theme/route.ts` | 테마 설정 저장 API |
| `src/components/admin/theme-settings-form.tsx` | 관리자 테마 설정 폼 (컬러 피커, 모드 토글) |
| `src/components/public/donation/StepProgressBar.tsx` | 위저드 스텝 프로그레스바 |
| `src/components/public/donation/AmountSelector.tsx` | 금액 선택 카드 (공유) |
| `src/components/public/donation/DonationTypeToggle.tsx` | 일시/정기 카드형 선택 (공유) |
| `src/components/public/donation/PayMethodSelector.tsx` | 결제수단 아이콘 선택 (공유) |
| `src/components/public/donation/AgreementSection.tsx` | 약관 동의 (전체동의 + 개별) |
| `src/components/public/donation/StickyCtaButton.tsx` | 모바일 하단 고정 CTA |

### 수정 파일
| 파일 | 변경 내용 |
|------|-----------|
| `src/app/(public)/layout.tsx` | 테넌트 theme_config 로드, CSS 변수 주입 |
| `src/app/(admin)/admin/settings/page.tsx` | 테마 설정 섹션 추가 |
| `src/lib/campaign-builder/form-settings/schema.ts` | `amountDescriptions` 필드 추가 |
| `src/app/donate/wizard/WizardClient.tsx` | StepProgressBar 적용, 토큰 |
| `src/app/donate/wizard/steps/Step1.tsx` | 공유 컴포넌트 + 토큰 |
| `src/app/donate/wizard/steps/Step2.tsx` | 공유 컴포넌트 + 약관 + 토큰 |
| `src/app/donate/wizard/steps/Step3.tsx` | 완료 화면 개선 + 토큰 |
| `src/components/public/donation-form.tsx` | 공유 컴포넌트로 교체 |
| `src/app/(public)/page.tsx` | 캠페인 카드 개선 |

---

### Task 1: 테마 시스템 — DB 마이그레이션

**Files:**
- Create: `supabase/migrations/20260417100001_org_theme_config.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 기관별 테마 설정
ALTER TABLE orgs ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT NULL;

COMMENT ON COLUMN orgs.theme_config IS '기관별 공개 페이지 테마 설정 (mode, accent, bg 등 CSS 변수 오버라이드)';
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/20260417100001_org_theme_config.sql
git commit -m "feat(db): orgs.theme_config JSONB 컬럼 추가"
```

---

### Task 2: 테마 시스템 — ThemeConfig 타입 및 CSS 변환

**Files:**
- Create: `src/lib/theme/config.ts`

- [ ] **Step 1: ThemeConfig 타입, 기본값, CSS 생성 함수 구현**

```typescript
import { z } from 'zod';

export const ThemeConfigSchema = z.object({
  mode: z.enum(['dark', 'light']).default('dark'),
  accent: z.string().default('#7c3aed'),
  accentSoft: z.string().default('rgba(124,58,237,0.12)'),
  bg: z.string().optional(),
  surface: z.string().optional(),
  surfaceTwo: z.string().optional(),
  text: z.string().optional(),
  mutedForeground: z.string().optional(),
  border: z.string().optional(),
});

export type ThemeConfig = z.infer<typeof ThemeConfigSchema>;

const DARK_DEFAULTS = {
  bg: '#0a0a0f',
  surface: '#13131a',
  surfaceTwo: '#1c1c27',
  text: '#f0f0f8',
  mutedForeground: '#8888aa',
  border: '#2a2a3a',
};

const LIGHT_DEFAULTS = {
  bg: '#ffffff',
  surface: '#f8f8fa',
  surfaceTwo: '#f0f0f4',
  text: '#1a1a2e',
  mutedForeground: '#6b7280',
  border: '#e5e7eb',
};

export function defaultThemeConfig(): ThemeConfig {
  return { mode: 'dark', accent: '#7c3aed', accentSoft: 'rgba(124,58,237,0.12)' };
}

/**
 * 테넌트 theme_config -> CSS 변수 오버라이드 문자열.
 *
 * 반환값은 서버에서 생성한 CSS 문자열이며 사용자 입력이 아닌
 * DB의 검증된 ThemeConfig 값으로부터 조립됩니다.
 */
export function themeConfigToCss(config: ThemeConfig | null | undefined): string {
  if (!config) return '';

  const parsed = ThemeConfigSchema.parse(config);
  const defaults = parsed.mode === 'light' ? LIGHT_DEFAULTS : DARK_DEFAULTS;

  const vars: Record<string, string> = {
    '--accent': parsed.accent,
    '--accent-soft': parsed.accentSoft,
    '--bg': parsed.bg ?? defaults.bg,
    '--surface': parsed.surface ?? defaults.surface,
    '--surface-2': parsed.surfaceTwo ?? defaults.surfaceTwo,
    '--text': parsed.text ?? defaults.text,
    '--muted-foreground': parsed.mutedForeground ?? defaults.mutedForeground,
    '--border': parsed.border ?? defaults.border,
    // shadcn alias
    '--background': parsed.bg ?? defaults.bg,
    '--foreground': parsed.text ?? defaults.text,
    '--card': parsed.surface ?? defaults.surface,
    '--card-foreground': parsed.text ?? defaults.text,
    '--primary': parsed.accent,
    '--ring': parsed.accent,
    '--input': parsed.border ?? defaults.border,
  };

  const lines = Object.entries(vars).map(([k, v]) => `${k}: ${v};`).join(' ');
  return `:root { ${lines} }`;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/theme/config.ts
git commit -m "feat: ThemeConfig 타입 + CSS 변수 변환 함수"
```

---

### Task 3: 테마 시스템 — 공개 레이아웃에 테마 CSS 주입

**Files:**
- Modify: `src/app/(public)/layout.tsx`

- [ ] **Step 1: 테넌트 theme_config 로드 + style 태그 주입**

테넌트 DB에서 theme_config를 로드하고, `themeConfigToCss()`로 CSS 문자열을 생성하여 `<style>` 태그로 주입합니다. 이 CSS 문자열은 서버에서 ThemeConfigSchema로 검증된 값으로부터 조립되며, 사용자가 직접 입력한 HTML/JS가 아닙니다.

```tsx
import PublicNav from "@/components/public/nav";
import { getTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { themeConfigToCss } from "@/lib/theme/config";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let themeCss = '';

  const tenant = await getTenant().catch(() => null);
  if (tenant) {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from('orgs')
      .select('theme_config')
      .eq('id', tenant.id)
      .single();
    if (data?.theme_config) {
      themeCss = themeConfigToCss(data.theme_config as any);
    }
  }

  return (
    <div
      style={{ background: "var(--bg)", color: "var(--text)" }}
      className="min-h-screen"
    >
      {/* Server-generated CSS from validated ThemeConfig — not user HTML */}
      {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
      <PublicNav />
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/(public)/layout.tsx
git commit -m "feat: 공개 레이아웃에 기관 테마 CSS 변수 주입"
```

---

### Task 4: 테마 시스템 — 관리자 테마 설정 API + UI

**Files:**
- Create: `src/app/api/admin/settings/theme/route.ts`
- Create: `src/components/admin/theme-settings-form.tsx`
- Modify: `src/app/(admin)/admin/settings/page.tsx`

- [ ] **Step 1: 테마 저장 API 구현**

```typescript
// src/app/api/admin/settings/theme/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ThemeConfigSchema } from '@/lib/theme/config';

export async function PATCH(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = ThemeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid theme config', issues: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('orgs')
    .update({ theme_config: parsed.data })
    .eq('id', tenant.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 테마 설정 폼 컴포넌트 구현**

```tsx
// src/components/admin/theme-settings-form.tsx
'use client';

import { useState } from 'react';

const ACCENT_PRESETS = [
  { label: '보라', value: '#7c3aed', soft: 'rgba(124,58,237,0.12)' },
  { label: '파랑', value: '#3b82f6', soft: 'rgba(59,130,246,0.12)' },
  { label: '초록', value: '#10b981', soft: 'rgba(16,185,129,0.12)' },
  { label: '핑크', value: '#ec4899', soft: 'rgba(236,72,153,0.12)' },
  { label: '주황', value: '#f97316', soft: 'rgba(249,115,22,0.12)' },
  { label: '남색', value: '#6366f1', soft: 'rgba(99,102,241,0.12)' },
];

type ThemeForm = {
  mode: 'dark' | 'light';
  accent: string;
  accentSoft: string;
};

export function ThemeSettingsForm({ initial }: { initial: ThemeForm | null }) {
  const [form, setForm] = useState<ThemeForm>(
    initial ?? { mode: 'dark', accent: '#7c3aed', accentSoft: 'rgba(124,58,237,0.12)' },
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch('/api/admin/settings/theme', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    alert(res.ok ? '저장되었습니다.' : '저장 실패');
  }

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
          테마 모드
        </span>
        <div className="flex gap-2">
          {(['dark', 'light'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setForm({ ...form, mode: m })}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors"
              style={{
                background: form.mode === m ? 'var(--accent)' : 'var(--surface-2)',
                borderColor: form.mode === m ? 'var(--accent)' : 'var(--border)',
                color: form.mode === m ? '#fff' : 'var(--text)',
              }}
            >
              {m === 'dark' ? '다크' : '라이트'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
          브랜드 색상
        </span>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setForm({ ...form, accent: p.value, accentSoft: p.soft })}
              className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors"
              style={{
                borderColor: form.accent === p.value ? p.value : 'var(--border)',
                background: form.accent === p.value ? p.soft : 'var(--surface-2)',
                color: 'var(--text)',
              }}
            >
              <span className="h-4 w-4 rounded-full" style={{ background: p.value }} />
              {p.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            커스텀:
          </label>
          <input
            type="color"
            value={form.accent}
            onChange={(e) =>
              setForm({ ...form, accent: e.target.value, accentSoft: `${e.target.value}1f` })
            }
            className="h-8 w-8 cursor-pointer rounded border-0"
          />
          <span className="font-mono text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {form.accent}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--accent)' }}
      >
        {saving ? '저장 중…' : '테마 저장'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 관리자 설정 페이지에 테마 섹션 추가**

`src/app/(admin)/admin/settings/page.tsx`에서:

1. `orgData` select 쿼리에 `theme_config` 추가
2. `ThemeSettingsForm` import
3. 페이지 하단에 테마 설정 섹션 렌더링

org select 변경:
```typescript
.select("name, business_no, logo_url, hero_image_url, tagline, about, contact_email, contact_phone, address, show_stats, bank_name, bank_account, account_holder, theme_config")
```

페이지 하단에 섹션 추가:
```tsx
import { ThemeSettingsForm } from "@/components/admin/theme-settings-form";

{/* 테마 설정 */}
<section
  className="rounded-xl border p-6"
  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
>
  <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--text)' }}>
    공개 페이지 테마
  </h2>
  <ThemeSettingsForm initial={(orgData as any)?.theme_config ?? null} />
</section>
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/admin/settings/theme/route.ts src/components/admin/theme-settings-form.tsx src/app/(admin)/admin/settings/page.tsx
git commit -m "feat: 관리자 테마 설정 API + 폼 + 설정 페이지 연동"
```

---

### Task 5: FormSettings에 amountDescriptions 추가

**Files:**
- Modify: `src/lib/campaign-builder/form-settings/schema.ts`

- [ ] **Step 1: amountDescriptions 필드 추가**

`FormSettingsSchema` z.object에 추가:
```typescript
amountDescriptions: z.record(z.coerce.number(), z.string()).default({}),
```

`defaultFormSettings()`에 추가:
```typescript
amountDescriptions: {},
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/campaign-builder/form-settings/schema.ts
git commit -m "feat: FormSettings에 amountDescriptions 필드 추가"
```

---

### Task 6: 공유 컴포넌트 — DonationTypeToggle

**Files:**
- Create: `src/components/public/donation/DonationTypeToggle.tsx`

- [ ] **Step 1: 카드형 일시/정기 선택 컴포넌트 구현**

```tsx
'use client';

type Props = {
  value: 'onetime' | 'regular';
  options: ('onetime' | 'regular')[];
  onChange: (v: 'onetime' | 'regular') => void;
};

const TYPE_INFO = {
  onetime: { label: '일시후원', desc: '한 번의 소중한 나눔', icon: '💝' },
  regular: { label: '정기후원', desc: '매월 꾸준한 변화', icon: '🔄' },
} as const;

export function DonationTypeToggle({ value, options, onChange }: Props) {
  if (options.length <= 1) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((t) => {
        const info = TYPE_INFO[t];
        const selected = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className="flex flex-col items-center gap-1 rounded-xl border-2 px-4 py-4 text-center transition-all"
            style={{
              borderColor: selected ? 'var(--accent)' : 'var(--border)',
              background: selected ? 'var(--accent-soft)' : 'var(--surface)',
              color: selected ? 'var(--accent)' : 'var(--text)',
            }}
          >
            <span className="text-2xl">{info.icon}</span>
            <span className="text-sm font-semibold">{info.label}</span>
            <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
              {info.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/public/donation/DonationTypeToggle.tsx
git commit -m "feat: DonationTypeToggle 공유 컴포넌트"
```

---

### Task 7: 공유 컴포넌트 — AmountSelector

**Files:**
- Create: `src/components/public/donation/AmountSelector.tsx`

- [ ] **Step 1: 금액 카드 + 사용처 설명 + 직접 입력 컴포넌트 구현**

```tsx
'use client';

import { useState } from 'react';

type Props = {
  presets: number[];
  descriptions?: Record<number, string>;
  value: number;
  onChange: (v: number) => void;
  allowCustom?: boolean;
  minAmount?: number;
};

function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function AmountSelector({
  presets,
  descriptions,
  value,
  onChange,
  allowCustom = true,
  minAmount = 1000,
}: Props) {
  const [customInput, setCustomInput] = useState('');
  const isCustom = customInput !== '' && !presets.includes(value);

  function handlePreset(amount: number) {
    setCustomInput('');
    onChange(amount);
  }

  function handleCustom(raw: string) {
    const numeric = raw.replace(/[^0-9]/g, '');
    setCustomInput(numeric);
    const parsed = Number(numeric);
    if (Number.isFinite(parsed) && parsed > 0) {
      onChange(parsed);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {presets.map((amount) => {
          const selected = !isCustom && value === amount;
          const desc = descriptions?.[amount];
          return (
            <button
              key={amount}
              type="button"
              onClick={() => handlePreset(amount)}
              className="flex flex-col items-center gap-0.5 rounded-xl border-2 px-3 py-3 transition-all"
              style={{
                borderColor: selected ? 'var(--accent)' : 'var(--border)',
                background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                color: selected ? 'var(--accent)' : 'var(--text)',
                minHeight: '44px',
              }}
            >
              <span className="text-sm font-bold">{formatAmount(amount)}원</span>
              {desc && (
                <span
                  className="text-[10px] leading-tight"
                  style={{ color: 'var(--muted-foreground)' }}
                >
                  {desc}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {allowCustom && (
        <div>
          <input
            type="text"
            inputMode="numeric"
            value={customInput}
            onChange={(e) => handleCustom(e.target.value)}
            placeholder="직접 입력 (원)"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              minHeight: '44px',
            }}
          />
          {customInput && Number(customInput) < minAmount && (
            <p className="mt-1 text-xs" style={{ color: 'var(--negative)' }}>
              최소 {formatAmount(minAmount)}원 이상 입력해주세요.
            </p>
          )}
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        결제 예정 금액:{' '}
        <strong style={{ color: 'var(--text)' }}>{formatAmount(value)}원</strong>
      </p>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/public/donation/AmountSelector.tsx
git commit -m "feat: AmountSelector 공유 컴포넌트 (금액 카드 + 사용처 설명)"
```

---

### Task 8: 공유 컴포넌트 — PayMethodSelector

**Files:**
- Create: `src/components/public/donation/PayMethodSelector.tsx`

- [ ] **Step 1: 결제수단 아이콘 카드 선택 컴포넌트 구현**

```tsx
'use client';

type Props = {
  methods: string[];
  value: string;
  onChange: (v: string) => void;
};

const METHOD_INFO: Record<string, { label: string; icon: string }> = {
  card: { label: '신용/체크카드', icon: '💳' },
  kakaopay: { label: '카카오페이', icon: '🟡' },
  naverpay: { label: '네이버페이', icon: '🟢' },
  payco: { label: '페이코', icon: '🔴' },
  transfer: { label: '계좌이체', icon: '🏦' },
  cms: { label: 'CMS 자동이체', icon: '📋' },
  virtual: { label: '가상계좌', icon: '🔢' },
  manual: { label: '수기 결제', icon: '✍️' },
};

export function PayMethodSelector({ methods, value, onChange }: Props) {
  if (methods.length <= 1) return null;

  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium" style={{ color: 'var(--text)' }}>
        결제 수단
      </span>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {methods.map((m) => {
          const info = METHOD_INFO[m] ?? { label: m, icon: '💰' };
          const selected = value === m;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className="flex items-center gap-2 rounded-lg border-2 px-3 py-2.5 text-sm transition-all"
              style={{
                borderColor: selected ? 'var(--accent)' : 'var(--border)',
                background: selected ? 'var(--accent-soft)' : 'var(--surface)',
                color: selected ? 'var(--accent)' : 'var(--text)',
                minHeight: '44px',
              }}
            >
              <span className="text-lg">{info.icon}</span>
              <span className="font-medium">{info.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/public/donation/PayMethodSelector.tsx
git commit -m "feat: PayMethodSelector 공유 컴포넌트 (결제수단 아이콘 카드)"
```

---

### Task 9: 공유 컴포넌트 — AgreementSection

**Files:**
- Create: `src/components/public/donation/AgreementSection.tsx`

- [ ] **Step 1: 전체동의 + 개별 약관 토글 컴포넌트 구현**

AgreementSection은 admin이 작성한 약관 HTML을 `sanitizeHtml`(DOMPurify)로 정화한 뒤 렌더링합니다. 이 패턴은 기존 `Step2.tsx`와 동일합니다.

```tsx
'use client';

import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';

type AgreementState = {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
};

type Props = {
  state: AgreementState;
  onChange: (s: AgreementState) => void;
  termsBodyHtml?: string;
  marketingLabel?: string;
};

export function AgreementSection({ state, onChange, termsBodyHtml, marketingLabel }: Props) {
  const allRequired = state.terms && state.privacy;
  const allChecked = allRequired && (!marketingLabel || state.marketing);

  function toggleAll() {
    const next = !allChecked;
    onChange({ terms: next, privacy: next, marketing: next });
  }

  const sanitizedTerms = termsBodyHtml ? sanitizeHtml(termsBodyHtml) : '';

  return (
    <div
      className="space-y-3 rounded-xl border p-4"
      style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
    >
      {/* 전체 동의 */}
      <label
        className="flex items-center gap-2 text-sm font-semibold"
        style={{ color: 'var(--text)' }}
      >
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        전체 동의
      </label>

      <div className="border-t" style={{ borderColor: 'var(--border)' }} />

      {/* 약관 본문 — sanitizeHtml (DOMPurify) 적용 */}
      {sanitizedTerms && (
        <div
          className="max-h-28 overflow-auto rounded-lg p-3 text-xs"
          style={{ background: 'var(--surface-2)', color: 'var(--muted-foreground)' }}
          dangerouslySetInnerHTML={{ __html: sanitizedTerms }}
        />
      )}

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
        <input
          type="checkbox"
          checked={state.terms}
          onChange={(e) => onChange({ ...state, terms: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span>[필수] 이용약관 동의</span>
      </label>

      <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
        <input
          type="checkbox"
          checked={state.privacy}
          onChange={(e) => onChange({ ...state, privacy: e.target.checked })}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <span>[필수] 개인정보 수집·이용 동의</span>
      </label>

      {marketingLabel && (
        <label
          className="flex items-center gap-2 text-sm"
          style={{ color: 'var(--muted-foreground)' }}
        >
          <input
            type="checkbox"
            checked={state.marketing}
            onChange={(e) => onChange({ ...state, marketing: e.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span>[선택] {marketingLabel}</span>
        </label>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/public/donation/AgreementSection.tsx
git commit -m "feat: AgreementSection 공유 컴포넌트 (전체동의 + 개별 약관)"
```

---

### Task 10: 공유 컴포넌트 — StepProgressBar + StickyCtaButton

**Files:**
- Create: `src/components/public/donation/StepProgressBar.tsx`
- Create: `src/components/public/donation/StickyCtaButton.tsx`

- [ ] **Step 1: StepProgressBar 구현**

```tsx
'use client';

const STEP_LABELS = ['후원 선택', '정보 입력', '결제 완료'];

export function StepProgressBar({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mb-8 flex items-center gap-0">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as 1 | 2 | 3;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex flex-1 flex-col items-center">
            <div className="flex w-full items-center">
              {i > 0 && (
                <div
                  className="h-0.5 flex-1"
                  style={{ background: isDone || isActive ? 'var(--accent)' : 'var(--border)' }}
                />
              )}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors"
                style={{
                  background: isDone || isActive ? 'var(--accent)' : 'var(--surface-2)',
                  color: isDone || isActive ? '#fff' : 'var(--muted-foreground)',
                }}
              >
                {isDone ? '✓' : step}
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className="h-0.5 flex-1"
                  style={{ background: isDone ? 'var(--accent)' : 'var(--border)' }}
                />
              )}
            </div>
            <span
              className="mt-1.5 text-[10px] font-medium"
              style={{ color: isActive ? 'var(--accent)' : 'var(--muted-foreground)' }}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: StickyCtaButton 구현**

```tsx
'use client';

type Props = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
};

export function StickyCtaButton({ label, onClick, disabled, type = 'button' }: Props) {
  return (
    <div
      className="sticky bottom-0 z-30 -mx-4 mt-6 px-4 pb-4 pt-3"
      style={{ background: 'linear-gradient(to top, var(--bg) 60%, transparent)' }}
    >
      <button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className="w-full rounded-xl py-3.5 text-base font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{ background: 'var(--accent)', minHeight: '48px' }}
      >
        {label}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/components/public/donation/StepProgressBar.tsx src/components/public/donation/StickyCtaButton.tsx
git commit -m "feat: StepProgressBar + StickyCtaButton 공유 컴포넌트"
```

---

### Task 11: 위저드 Step1 고도화

**Files:**
- Modify: `src/app/donate/wizard/steps/Step1.tsx`

- [ ] **Step 1: 공유 컴포넌트 + 디자인 토큰 적용으로 전체 교체**

```tsx
'use client';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';
import { DonationTypeToggle } from '@/components/public/donation/DonationTypeToggle';
import { AmountSelector } from '@/components/public/donation/AmountSelector';
import { StickyCtaButton } from '@/components/public/donation/StickyCtaButton';

export function Step1({
  settings,
  state,
  setState,
  onNext,
}: {
  settings: FormSettings;
  state: WizardState;
  setState: (s: WizardState) => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <DonationTypeToggle
        value={state.type}
        options={settings.donationTypes}
        onChange={(v) => setState({ ...state, type: v })}
      />

      <div>
        <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
          후원 금액
        </span>
        <AmountSelector
          presets={settings.amountPresets}
          descriptions={(settings as any).amountDescriptions}
          value={state.amount}
          onChange={(v) => setState({ ...state, amount: v })}
          allowCustom={settings.allowCustomAmount}
        />
      </div>

      {settings.designations.length > 0 && (
        <div>
          <span className="mb-2 block text-sm font-medium" style={{ color: 'var(--text)' }}>
            후원 목적
          </span>
          <select
            value={state.designation ?? ''}
            onChange={(e) => setState({ ...state, designation: e.target.value || undefined })}
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
              color: 'var(--text)',
              minHeight: '44px',
            }}
          >
            <option value="">선택 안 함</option>
            {settings.designations.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <StickyCtaButton label="다음" onClick={onNext} disabled={state.amount <= 0} />
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/donate/wizard/steps/Step1.tsx
git commit -m "feat: 위저드 Step1 공유 컴포넌트 + 디자인 토큰 고도화"
```

---

### Task 12: 위저드 Step2 고도화

**Files:**
- Modify: `src/app/donate/wizard/steps/Step2.tsx`

- [ ] **Step 1: 공유 컴포넌트 + 디자인 토큰으로 전체 교체**

```tsx
'use client';
import { useState } from 'react';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';
import { PayMethodSelector } from '@/components/public/donation/PayMethodSelector';
import { AgreementSection } from '@/components/public/donation/AgreementSection';

declare global {
  interface Window {
    gtag?: (...a: unknown[]) => void;
  }
}

function Input({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium" style={{ color: 'var(--text)' }}>
        {label} {required && <span style={{ color: 'var(--negative)' }}>*</span>}
      </span>
      <input
        type={type}
        className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--surface-2)',
          color: 'var(--text)',
          minHeight: '44px',
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function Step2({
  campaign,
  settings,
  state,
  setState,
  onBack,
  onDone,
}: {
  campaign: { id: string; slug: string; title: string };
  settings: FormSettings;
  state: WizardState;
  setState: (s: WizardState) => void;
  onBack: () => void;
  onDone: () => void;
}) {
  const [info, setInfo] = useState({ name: '', dob: '', mobile: '', email: '', address: '' });
  const [customFields, setCustomFields] = useState<Record<string, unknown>>({});
  const [method, setMethod] = useState(settings.paymentMethods[0] ?? 'card');
  const [receipt, setReceipt] = useState(settings.requireReceipt);
  const [residentNo, setResidentNo] = useState('');
  const [ag, setAg] = useState({ terms: false, privacy: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!ag.terms || !ag.privacy) return alert('필수 약관에 동의해 주세요.');
    setSubmitting(true);
    setState({
      ...state,
      donorInfo: info,
      paymentMethod: method,
      customFields,
      receiptOptIn: receipt,
    });
    window.gtag?.('event', 'add_payment_info', { value: state.amount, currency: 'KRW' });

    const res = await fetch('/api/donations/prepare', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id,
        amount: state.amount,
        donationType: state.type,
        designation: state.designation,
        memberName: info.name,
        memberPhone: info.mobile,
        memberEmail: info.email,
        customFields,
        payMethod: method,
        receiptOptIn: receipt,
        residentNo: receipt ? residentNo : undefined,
        idempotencyKey: state.idempotencyKey,
      }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return alert(
        (err as Record<string, string>)?.error ?? '후원 준비 중 오류가 발생했습니다.',
      );
    }

    const data = (await res.json()) as { offline?: boolean; checkoutUrl?: string };
    if (data.offline || !data.checkoutUrl) {
      onDone();
      return;
    }
    window.location.href = data.checkoutUrl;
  }

  return (
    <div className="space-y-5">
      <Input label="이름" value={info.name} onChange={(v) => setInfo({ ...info, name: v })} required placeholder="홍길동" />
      <Input label="생년월일" type="date" value={info.dob} onChange={(v) => setInfo({ ...info, dob: v })} />
      <Input label="휴대폰" value={info.mobile} onChange={(v) => setInfo({ ...info, mobile: v })} required placeholder="010-1234-5678" />
      <Input label="이메일" type="email" value={info.email} onChange={(v) => setInfo({ ...info, email: v })} placeholder="email@example.com" />
      <Input label="주소" value={info.address} onChange={(v) => setInfo({ ...info, address: v })} />

      {settings.customFields.map((f) => (
        <Input
          key={f.key}
          label={f.label}
          value={(customFields[f.key] as string) ?? ''}
          onChange={(v) => setCustomFields({ ...customFields, [f.key]: v })}
          required={f.required}
        />
      ))}

      <PayMethodSelector methods={settings.paymentMethods} value={method} onChange={setMethod} />

      {/* 기부금 영수증 */}
      <div
        className="space-y-2 rounded-xl border p-4"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>
          🧾 기부금 영수증
        </span>
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <input
            type="checkbox"
            checked={receipt}
            onChange={(e) => setReceipt(e.target.checked)}
            disabled={settings.requireReceipt}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          기부금 영수증 신청
        </label>
        {receipt && (
          <Input
            label="주민번호 / 사업자번호"
            value={residentNo}
            onChange={setResidentNo}
            placeholder="000000-0000000"
          />
        )}
      </div>

      <AgreementSection
        state={ag}
        onChange={setAg}
        termsBodyHtml={settings.termsBodyHtml}
        marketingLabel={settings.marketingOptInLabel}
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-xl border py-3 text-sm font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--text)', minHeight: '48px' }}
        >
          이전
        </button>
        <button
          type="button"
          disabled={submitting || !info.name || !info.mobile}
          onClick={submit}
          className="flex-1 rounded-xl py-3 text-sm font-semibold text-white disabled:opacity-50"
          style={{ background: 'var(--accent)', minHeight: '48px' }}
        >
          {submitting ? '처리 중…' : '후원하기'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/donate/wizard/steps/Step2.tsx
git commit -m "feat: 위저드 Step2 공유 컴포넌트 + 디자인 토큰 고도화"
```

---

### Task 13: 위저드 Step3 + WizardClient 고도화

**Files:**
- Modify: `src/app/donate/wizard/steps/Step3.tsx`
- Modify: `src/app/donate/wizard/WizardClient.tsx`

- [ ] **Step 1: Step3 완료 화면 개선**

```tsx
'use client';
import { useEffect } from 'react';
import type { WizardState } from '../WizardClient';

declare global {
  interface Window {
    gtag?: (...a: unknown[]) => void;
  }
}

function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n);
}

export function Step3({
  campaign,
  settings,
  state,
}: {
  campaign: { slug: string };
  settings: { completeRedirectUrl?: string | null };
  state: WizardState;
}) {
  useEffect(() => {
    window.gtag?.('event', 'purchase', { value: state.amount, currency: 'KRW' });
    if (settings.completeRedirectUrl) {
      setTimeout(() => {
        window.location.href = settings.completeRedirectUrl!;
      }, 3000);
    }
  }, []);

  return (
    <div className="space-y-6 text-center">
      <div
        className="mx-auto flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-white"
        style={{ background: 'var(--positive)' }}
      >
        ✓
      </div>
      <h2 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
        후원해 주셔서 감사합니다
      </h2>

      <div
        className="rounded-xl border p-5 text-left text-sm"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex justify-between py-1.5">
          <span style={{ color: 'var(--muted-foreground)' }}>후원 유형</span>
          <span className="font-medium" style={{ color: 'var(--text)' }}>
            {state.type === 'regular' ? '정기 후원' : '일시 후원'}
          </span>
        </div>
        <div className="flex justify-between py-1.5">
          <span style={{ color: 'var(--muted-foreground)' }}>후원 금액</span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>
            {formatAmount(state.amount)}원
          </span>
        </div>
        {state.receiptOptIn && (
          <div className="flex justify-between py-1.5">
            <span style={{ color: 'var(--muted-foreground)' }}>기부금 영수증</span>
            <span style={{ color: 'var(--positive)' }}>신청됨</span>
          </div>
        )}
      </div>

      {state.receiptOptIn && (
        <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
          기부금 영수증은 등록하신 이메일로 발송됩니다.
        </p>
      )}

      {settings.completeRedirectUrl && (
        <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
          잠시 후 자동으로 이동합니다…
        </p>
      )}

      <a
        href={`/campaigns/${campaign.slug}`}
        className="inline-flex items-center justify-center rounded-xl border px-6 py-2.5 text-sm font-medium transition-opacity hover:opacity-80"
        style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
      >
        캠페인으로 돌아가기
      </a>
    </div>
  );
}
```

- [ ] **Step 2: WizardClient에 StepProgressBar 적용 + 토큰**

```tsx
'use client';
import { useState } from 'react';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import { StepProgressBar } from '@/components/public/donation/StepProgressBar';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export type WizardState = {
  type: 'regular' | 'onetime';
  amount: number;
  designation?: string;
  donorInfo?: Record<string, string>;
  paymentMethod?: string;
  customFields?: Record<string, unknown>;
  receiptOptIn?: boolean;
  idempotencyKey: string;
};

export function WizardClient({
  campaign,
  settings,
  prefill,
}: {
  campaign: { id: string; slug: string; title: string; orgId: string };
  settings: FormSettings;
  prefill: { type?: string; amount?: number; designation?: string; completed?: boolean };
}) {
  const [step, setStep] = useState<1 | 2 | 3>(prefill.completed ? 3 : 1);
  const [state, setState] = useState<WizardState>({
    type: (prefill.type as 'regular' | 'onetime') ?? settings.donationTypes[0] ?? 'onetime',
    amount: prefill.amount ?? settings.amountPresets[0] ?? 10000,
    designation: prefill.designation,
    idempotencyKey: crypto.randomUUID(),
  });

  return (
    <main className="mx-auto max-w-xl px-4 py-8">
      <h1 className="mb-2 text-xl font-bold" style={{ color: 'var(--text)' }}>
        {campaign.title}
      </h1>
      <StepProgressBar current={step} />

      {step === 1 && (
        <Step1
          settings={settings}
          state={state}
          setState={setState}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <Step2
          campaign={campaign}
          settings={settings}
          state={state}
          setState={setState}
          onBack={() => setStep(1)}
          onDone={() => setStep(3)}
        />
      )}
      {step === 3 && <Step3 campaign={campaign} settings={settings} state={state} />}
    </main>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/donate/wizard/steps/Step3.tsx src/app/donate/wizard/WizardClient.tsx
git commit -m "feat: 위저드 Step3 완료 화면 + WizardClient StepProgressBar 고도화"
```

---

### Task 14: 레거시 후원 폼 — 공유 컴포넌트 교체

**Files:**
- Modify: `src/components/public/donation-form.tsx`

- [ ] **Step 1: DonationTypeToggle, AmountSelector, PayMethodSelector로 교체**

기존 `donation-form.tsx`에서:
1. 후원 유형 토글 → `DonationTypeToggle` import & 사용
2. 금액 프리셋 + 직접 입력 → `AmountSelector` import & 사용
3. 결제수단 버튼 → `PayMethodSelector` import & 사용

import 추가:
```typescript
import { DonationTypeToggle } from '@/components/public/donation/DonationTypeToggle';
import { AmountSelector } from '@/components/public/donation/AmountSelector';
import { PayMethodSelector } from '@/components/public/donation/PayMethodSelector';
```

JSX에서 해당 섹션들을 공유 컴포넌트 호출로 교체:
- 후원 유형 탭 → `<DonationTypeToggle value={donationType} options={showTypeTabs ? ['onetime','regular'] : [defaultType]} onChange={setDonationType} />`
- 금액 선택(프리셋 버튼 + 직접 입력 + 예정 금액) → `<AmountSelector presets={presetAmounts} value={amount} onChange={setAmount} />`
- 결제수단 → `<PayMethodSelector methods={availableMethods} value={payMethod} onChange={setPayMethod} />`
- submit 버튼 스타일: `rounded-xl`, `minHeight: '48px'`, `var(--accent)` 배경

기존의 `OfflineConfirmScreen` 컴포넌트와 Toss 결제 로직은 그대로 유지합니다.

- [ ] **Step 2: 커밋**

```bash
git add src/components/public/donation-form.tsx
git commit -m "feat: 레거시 후원 폼 — 공유 컴포넌트로 교체, 디자인 통일"
```

---

### Task 15: 메인 공개 페이지 개선

**Files:**
- Modify: `src/app/(public)/page.tsx`

- [ ] **Step 1: 캠페인 카드 + 안내 섹션 개선**

캠페인 카드 렌더링 부분에서:

1. 썸네일 없는 경우 placeholder 배경 추가:
```tsx
{campaign.thumbnail_url ? (
  <img src={campaign.thumbnail_url} alt={campaign.title} className="w-full h-40 object-cover" />
) : (
  <div
    className="w-full h-40"
    style={{ background: 'linear-gradient(135deg, var(--accent-soft), var(--surface-2))' }}
  />
)}
```

2. 카드 hover 애니메이션 (기존 `transition-shadow` → `transition-all`):
```tsx
className="rounded-xl border overflow-hidden h-full flex flex-col transition-all group-hover:shadow-lg group-hover:scale-[1.02]"
```

3. 카드에 `relative` 추가 + D-day 배지 (ended_at 있을 때), 카드 이미지 영역 내부:
```tsx
<div className="relative">
  {/* 썸네일 또는 placeholder */}
  {campaign.ended_at && (() => {
    const daysLeft = Math.max(0, Math.ceil((new Date(campaign.ended_at).getTime() - Date.now()) / 86_400_000));
    return (
      <span
        className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold"
        style={{ background: 'var(--accent)', color: '#fff' }}
      >
        D-{daysLeft}
      </span>
    );
  })()}
</div>
```

4. 카드 하단 `p-5` div 끝에 "후원하기 →" 텍스트 추가:
```tsx
<span className="mt-3 block text-sm font-semibold" style={{ color: 'var(--accent)' }}>
  후원하기 →
</span>
```

5. 후원 방법 안내 섹션에 아이콘 추가:
```tsx
{[
  { step: "1", title: "캠페인 선택", desc: "후원하고 싶은 캠페인을 선택하세요.", icon: "🔍" },
  { step: "2", title: "정보 입력", desc: "이름과 연락처를 입력하고 후원 금액을 정합니다.", icon: "✏️" },
  { step: "3", title: "결제 완료", desc: "카드·계좌이체·CMS 자동이체로 간편하게 결제합니다.", icon: "💳" },
].map((s) => (
  <div key={s.step} className="flex flex-col items-center gap-3">
    <span className="text-2xl">{s.icon}</span>
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-base"
      style={{ background: "var(--accent)" }}
    >
      {s.step}
    </div>
    <div className="font-semibold" style={{ color: "var(--text)" }}>{s.title}</div>
    <div style={{ color: "var(--muted-foreground)" }}>{s.desc}</div>
  </div>
))}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/(public)/page.tsx
git commit -m "feat: 메인 공개 페이지 — 캠페인 카드 + 안내 섹션 개선"
```
