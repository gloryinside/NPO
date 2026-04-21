# Landing Variant System — Phase A Implementation Plan

**Goal:** Variant 시스템 인프라 + hero 6 + cta 5 + stats 5 (16 variants) 구현해 production 배포 가능한 상태 만들기

**Architecture:**
- `LandingSection`에 `variant: string` 필드 추가 (schemaVersion 2)
- `VARIANT_CATALOG`로 variant 메타데이터(스키마/기본값/썸네일) 단일 소스화
- 각 variant는 `src/components/landing-builder/sections/{type}/{ComponentName}.tsx`에 1파일 1컴포넌트
- 에디터는 3단계 플로우 (타입 선택 → variant 갤러리 → data 편집)
- 기존 섹션은 lazy migration으로 `{type}-default` 매핑

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, zod (이미 설치), framer-motion (신규), TypeScript

---

## 1. Infra & Schema

### Task 1: framer-motion 설치

- [ ] **Step 1: 패키지 설치**

```bash
npm i framer-motion@^12
```

- [ ] **Step 2: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: framer-motion 추가 (landing variant 모션)"
```

---

### Task 2: 디자인 토큰 확장

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: 토큰 추가**

`src/app/globals.css` 의 `:root` 블록 끝에 아래 추가:

```css
  /* landing variant tokens */
  --gradient-1: linear-gradient(135deg, var(--accent), color-mix(in oklch, var(--accent), #000 30%));
  --gradient-soft: linear-gradient(180deg, var(--surface), var(--surface-2));
  --shadow-hero: 0 20px 60px -20px rgb(0 0 0 / 0.4);
  --shadow-card: 0 4px 20px -4px rgb(0 0 0 / 0.08);
  --radius-hero: 24px;
  --radius-card: 16px;
```

`@layer base` 혹은 동일 파일의 typography 섹션 말미에 아래 유틸 추가:

```css
.text-display { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 800; line-height: 1.05; letter-spacing: -0.02em; }
.text-hero    { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 800; line-height: 1.1; letter-spacing: -0.015em; }
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/globals.css
git commit -m "feat(landing): gradient/shadow/radius 토큰 + display typography"
```

---

### Task 3: LandingSection 타입에 variant 필드 추가 + SHARED_FIELDS

**Files:**
- Modify: `src/types/landing.ts`
- Modify: `src/lib/landing-defaults.ts`

- [ ] **Step 1: `variant` 필드 추가**

`src/types/landing.ts` 의 `LandingSection` 인터페이스 수정:

```ts
export interface LandingSection {
  id: string
  type: LandingSectionType
  variant: string              // NEW
  sortOrder: number
  isVisible: boolean
  data: LandingSectionData
}
```

`LandingPageContent` 의 `schemaVersion`을 `1 | 2` 로:

```ts
export interface LandingPageContent {
  schemaVersion: 1 | 2
  sections: LandingSection[]
}
```

파일 하단에 `SHARED_FIELDS` 추가:

```ts
export const SHARED_FIELDS: Record<LandingSectionType, readonly string[]> = {
  hero:             ['headline', 'subheadline', 'ctaText', 'ctaUrl', 'textAlign'],
  stats:            ['title', 'items'],
  impact:           ['title', 'blocks'],
  campaigns:        ['title', 'subtitle', 'maxCount', 'showProgress'],
  'donation-tiers': ['title', 'subtitle', 'tiers'],
  team:             ['title', 'members'],
  cta:              ['headline', 'body', 'buttonText', 'buttonUrl'],
  richtext:         ['title', 'content'],
}
```

- [ ] **Step 2: `createSection` 기본 variant 주입**

`src/lib/landing-defaults.ts` 의 `createSection` 수정:

```ts
export function createSection(type: LandingSectionType, sortOrder: number): LandingSection {
  return {
    id: nanoid(),
    type,
    variant: `${type}-${DEFAULT_VARIANT_SUFFIX[type]}`,
    sortOrder,
    isVisible: true,
    data: getDefaultSectionData(type),
  }
}

const DEFAULT_VARIANT_SUFFIX: Record<LandingSectionType, string> = {
  hero: 'minimal',
  stats: 'grid',
  impact: 'alternating',
  campaigns: 'grid',
  'donation-tiers': 'cards',
  team: 'grid',
  cta: 'banner',
  richtext: 'plain',
}
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```

Expected: `src/components/landing-builder/LandingSectionEditor.tsx` 등에서 기존 섹션이 `variant` 누락 에러는 **없어야 함** (신규 createSection 호출은 OK). Lazy migration 함수는 Task 4에서 처리.

- [ ] **Step 4: 커밋**

```bash
git add src/types/landing.ts src/lib/landing-defaults.ts
git commit -m "feat(landing): LandingSection에 variant 필드 + SHARED_FIELDS"
```

---

### Task 4: Lazy migration 함수

**Files:**
- Create: `src/lib/landing-migrate.ts`
- Test: `src/lib/__tests__/landing-migrate.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`src/lib/__tests__/landing-migrate.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { migrateToV2 } from '../landing-migrate'
import type { LandingPageContent } from '@/types/landing'

describe('migrateToV2', () => {
  it('v2 content는 그대로 반환한다', () => {
    const v2: LandingPageContent = {
      schemaVersion: 2,
      sections: [{ id: 'a', type: 'hero', variant: 'hero-minimal', sortOrder: 0, isVisible: true, data: {} as never }],
    }
    expect(migrateToV2(v2)).toBe(v2)
  })

  it('v1 sections는 {type}-default variant로 채워진다', () => {
    const v1 = {
      schemaVersion: 1 as const,
      sections: [
        { id: 'a', type: 'hero', sortOrder: 0, isVisible: true, data: {} as never },
        { id: 'b', type: 'cta', sortOrder: 1, isVisible: true, data: {} as never },
      ],
    } as LandingPageContent
    const r = migrateToV2(v1)
    expect(r.schemaVersion).toBe(2)
    expect(r.sections[0].variant).toBe('hero-minimal')
    expect(r.sections[1].variant).toBe('cta-banner')
  })

  it('이미 variant가 있으면 보존한다', () => {
    const mixed = {
      schemaVersion: 1 as const,
      sections: [{ id: 'a', type: 'hero', variant: 'hero-fullscreen-video', sortOrder: 0, isVisible: true, data: {} as never }],
    } as LandingPageContent
    expect(migrateToV2(mixed).sections[0].variant).toBe('hero-fullscreen-video')
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

```bash
npx vitest run src/lib/__tests__/landing-migrate.test.ts
```

Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**

`src/lib/landing-migrate.ts`:

```ts
import type { LandingPageContent, LandingSectionType } from '@/types/landing'

const DEFAULT_VARIANT: Record<LandingSectionType, string> = {
  hero: 'hero-minimal',
  stats: 'stats-grid',
  impact: 'impact-alternating',
  campaigns: 'campaigns-grid',
  'donation-tiers': 'tiers-cards',
  team: 'team-grid',
  cta: 'cta-banner',
  richtext: 'richtext-plain',
}

export function migrateToV2(content: LandingPageContent): LandingPageContent {
  if (content.schemaVersion === 2) return content
  return {
    schemaVersion: 2,
    sections: content.sections.map((s) => ({
      ...s,
      variant: s.variant ?? DEFAULT_VARIANT[s.type] ?? `${s.type}-default`,
    })),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run src/lib/__tests__/landing-migrate.test.ts
```

Expected: 3 passed

- [ ] **Step 5: 커밋**

```bash
git add src/lib/landing-migrate.ts src/lib/__tests__/landing-migrate.test.ts
git commit -m "feat(landing): v1→v2 lazy migration (default variant 매핑)"
```

---

### Task 5: GET/공개 페이지 로더에서 migration 호출

**Files:**
- Modify: `src/app/api/admin/org/landing/route.ts` (GET 핸들러)
- Modify: `src/app/(admin)/admin/landing/page.tsx`
- Modify: `src/app/(public)/page.tsx`

- [ ] **Step 1: GET 핸들러에 migration 적용**

`src/app/api/admin/org/landing/route.ts` 의 GET 내 `pageContent` 계산 부분 수정:

```ts
import { migrateToV2 } from '@/lib/landing-migrate'
// ...
  const rawPageContent: LandingPageContent =
    data.page_content && typeof data.page_content === 'object' &&
    'sections' in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT

  const pageContent = migrateToV2(rawPageContent)
```

- [ ] **Step 2: 어드민 로더에 migration 적용**

`src/app/(admin)/admin/landing/page.tsx` 내:

```ts
import { migrateToV2 } from "@/lib/landing-migrate";
// ...
  const pageContent = migrateToV2(
    data?.page_content &&
    typeof data.page_content === "object" &&
    "sections" in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT
  );
```

- [ ] **Step 3: 공개 랜딩 페이지 로더에 migration 적용**

`src/app/(public)/page.tsx` 에서 `page_content` / `published_content` 를 읽는 지점을 찾아 같은 방식으로 `migrateToV2()` 호출 (draft 모드와 published 모드 모두).

- [ ] **Step 4: 타입체크 & 수동 확인**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat(landing): 모든 read path에 v2 lazy migration 적용"
```

---

### Task 6: Variant 카탈로그 스켈레톤

**Files:**
- Create: `src/lib/landing-variants/types.ts`
- Create: `src/lib/landing-variants/index.ts`

- [ ] **Step 1: `VariantDescriptor` 타입 정의**

`src/lib/landing-variants/types.ts`:

```ts
import type { z } from 'zod'
import type { LandingSectionType, LandingSectionData } from '@/types/landing'

export type VisualWeight = 'minimal' | 'bold' | 'cinematic'

export interface VariantDescriptor {
  id: string
  type: LandingSectionType
  label: string
  description: string
  preview: string            // public 경로: /landing-variants/{id}.svg
  visualWeight: VisualWeight
  dataSchema: z.ZodSchema
  defaultData: () => LandingSectionData
}
```

- [ ] **Step 2: 빈 카탈로그 레지스트리**

`src/lib/landing-variants/index.ts`:

```ts
import type { LandingSectionType } from '@/types/landing'
import type { VariantDescriptor } from './types'

const registry: Partial<Record<LandingSectionType, VariantDescriptor[]>> = {}

export function registerVariants(type: LandingSectionType, variants: VariantDescriptor[]) {
  registry[type] = [...(registry[type] ?? []), ...variants]
}

export function getVariants(type: LandingSectionType): VariantDescriptor[] {
  return registry[type] ?? []
}

export function findVariant(variantId: string): VariantDescriptor | undefined {
  for (const variants of Object.values(registry)) {
    const match = variants?.find((v) => v.id === variantId)
    if (match) return match
  }
  return undefined
}

// 구체 variant 등록은 하위 파일에서 side-effect로 실행된다.
// Phase A에서 register 호출부를 import 해서 트리거한다.
import './hero'
import './cta'
import './stats'
```

- [ ] **Step 3: 자리 표시 파일 3개 생성** (아직 빈 register)

```bash
mkdir -p /Users/gloryinside/NPO_S/src/lib/landing-variants
```

Create empty files for side-effect import chain:

`src/lib/landing-variants/hero.ts`:
```ts
// populated in Task 7~8
```

`src/lib/landing-variants/cta.ts`:
```ts
// populated in Task 9~10
```

`src/lib/landing-variants/stats.ts`:
```ts
// populated in Task 11~12
```

- [ ] **Step 4: 커밋**

```bash
git add src/lib/landing-variants
git commit -m "feat(landing): variant 카탈로그 레지스트리 스켈레톤"
```

---

### Task 7: 공유 motion 유틸

**Files:**
- Create: `src/components/landing-builder/shared/MotionWrapper.tsx`
- Create: `src/components/landing-builder/shared/CountUp.tsx`
- Create: `src/components/landing-builder/shared/KenBurns.tsx`

- [ ] **Step 1: MotionWrapper (prefers-reduced-motion 가드 + fade-up)**

`src/components/landing-builder/shared/MotionWrapper.tsx`:

```tsx
'use client'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import type { ReactNode } from 'react'

interface Props extends HTMLMotionProps<'div'> {
  children: ReactNode
  delay?: number
}

export function MotionFadeUp({ children, delay = 0, ...rest }: Props) {
  const reduce = useReducedMotion()
  if (reduce) return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 2: CountUp**

`src/components/landing-builder/shared/CountUp.tsx`:

```tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

interface Props {
  value: string        // "1,200+" 처럼 포맷된 문자열
  durationMs?: number
}

/** 숫자가 포함된 문자열에서 숫자 부분만 추출해 0→N count up 애니메이션 */
export function CountUp({ value, durationMs = 1600 }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) { setShown(value); return }
    const match = value.match(/([\d,]+)/)
    if (!match) { setShown(value); return }
    const numStr = match[1].replace(/,/g, '')
    const target = parseInt(numStr, 10)
    if (!Number.isFinite(target)) { setShown(value); return }

    let raf = 0
    let start: number | null = null
    const suffix = value.slice(match.index! + match[0].length)
    const prefix = value.slice(0, match.index)

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      observer.disconnect()
      const tick = (ts: number) => {
        if (start === null) start = ts
        const p = Math.min((ts - start) / durationMs, 1)
        const current = Math.round(target * (0.5 - Math.cos(Math.PI * p) / 2))
        setShown(prefix + current.toLocaleString('ko-KR') + suffix)
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.3 })

    if (ref.current) observer.observe(ref.current)
    return () => { observer.disconnect(); cancelAnimationFrame(raf) }
  }, [value, durationMs, reduce])

  return <span ref={ref}>{shown}</span>
}
```

- [ ] **Step 3: KenBurns**

`src/components/landing-builder/shared/KenBurns.tsx`:

```tsx
'use client'
import { useReducedMotion } from 'framer-motion'

interface Props {
  imageUrl: string
  overlayOpacity: number   // 0~100
  enabled?: boolean
  children?: React.ReactNode
}

export function KenBurns({ imageUrl, overlayOpacity, enabled = true, children }: Props) {
  const reduce = useReducedMotion()
  const animate = enabled && !reduce
  const bg = `linear-gradient(to bottom, rgba(10,10,15,${overlayOpacity / 100}), rgba(10,10,15,${Math.min(overlayOpacity / 100 + 0.3, 1)})), url(${JSON.stringify(imageUrl)})`
  return (
    <div className="absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className={`absolute inset-0 bg-center bg-cover ${animate ? 'animate-ken-burns' : ''}`}
        style={{ backgroundImage: bg }}
      />
      {children}
    </div>
  )
}
```

`src/app/globals.css` 에 keyframe 추가:

```css
@keyframes ken-burns {
  0%   { transform: scale(1)    translate(0, 0); }
  50%  { transform: scale(1.08) translate(-1%, -1%); }
  100% { transform: scale(1)    translate(0, 0); }
}
.animate-ken-burns { animation: ken-burns 20s ease-in-out infinite; }
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/landing-builder/shared src/app/globals.css
git commit -m "feat(landing): shared motion utils (MotionFadeUp, CountUp, KenBurns)"
```

---

## 2. Hero Variants (6개)

### Task 8: hero 스키마 정의

**Files:**
- Create: `src/lib/landing-variants/hero-schemas.ts`
- Create: `src/lib/landing-variants/hero-defaults.ts`

- [ ] **Step 1: zod 스키마**

`src/lib/landing-variants/hero-schemas.ts`:

```ts
import { z } from 'zod'

export const HeroBase = z.object({
  headline: z.string().min(1).max(100),
  subheadline: z.string().max(300).optional(),
  ctaText: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
})

export const HeroMinimal = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
})

export const HeroSplitImage = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  rightImageUrl: z.string().url(),
  imageRatio: z.enum(['1:1', '4:3', '3:4']).default('1:1'),
})

export const HeroFullscreenImage = HeroBase.extend({
  bgImageUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(40),
  kenBurns: z.boolean().default(true),
})

export const HeroFullscreenVideo = HeroBase.extend({
  videoUrl: z.string().url(),
  posterUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(50),
  showMuteToggle: z.boolean().default(true),
})

export const HeroGallery = HeroBase.extend({
  images: z.array(z.object({ url: z.string().url(), alt: z.string().min(1).max(200) })).min(2).max(8),
  intervalMs: z.number().min(3000).max(15000).default(6000),
  overlayOpacity: z.number().min(30).max(100).default(40),
})

export const HeroStatsOverlay = HeroFullscreenImage.extend({
  stats: z.array(z.object({ value: z.string().max(20), label: z.string().max(40) })).min(2).max(4),
})

export type HeroMinimalData = z.infer<typeof HeroMinimal>
export type HeroSplitImageData = z.infer<typeof HeroSplitImage>
export type HeroFullscreenImageData = z.infer<typeof HeroFullscreenImage>
export type HeroFullscreenVideoData = z.infer<typeof HeroFullscreenVideo>
export type HeroGalleryData = z.infer<typeof HeroGallery>
export type HeroStatsOverlayData = z.infer<typeof HeroStatsOverlay>
```

- [ ] **Step 2: 기본값**

`src/lib/landing-variants/hero-defaults.ts`:

```ts
import type {
  HeroMinimalData, HeroSplitImageData, HeroFullscreenImageData,
  HeroFullscreenVideoData, HeroGalleryData, HeroStatsOverlayData,
} from './hero-schemas'

export const heroMinimalDefault = (): HeroMinimalData => ({
  bgColor: '#1a3a5c',
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroSplitImageDefault = (): HeroSplitImageData => ({
  bgColor: '#ffffff',
  rightImageUrl: 'https://picsum.photos/seed/hero/800/800',
  imageRatio: '1:1',
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'left',
})

export const heroFullscreenImageDefault = (): HeroFullscreenImageData => ({
  bgImageUrl: 'https://picsum.photos/seed/hero-fs/1920/1080',
  overlayOpacity: 50,
  kenBurns: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroFullscreenVideoDefault = (): HeroFullscreenVideoData => ({
  videoUrl: 'https://cdn.coverr.co/videos/coverr-community-volunteering-5670/1080p.mp4',
  posterUrl: 'https://picsum.photos/seed/hero-video/1920/1080',
  overlayOpacity: 50,
  showMuteToggle: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroGalleryDefault = (): HeroGalleryData => ({
  images: [
    { url: 'https://picsum.photos/seed/g1/1600/900', alt: '아이들과 함께하는 활동' },
    { url: 'https://picsum.photos/seed/g2/1600/900', alt: '지역사회 캠페인 현장' },
    { url: 'https://picsum.photos/seed/g3/1600/900', alt: '후원자 봉사 현장' },
  ],
  intervalMs: 6000,
  overlayOpacity: 45,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
})

export const heroStatsOverlayDefault = (): HeroStatsOverlayData => ({
  bgImageUrl: 'https://picsum.photos/seed/hero-so/1920/1080',
  overlayOpacity: 55,
  kenBurns: true,
  headline: '함께 만드는 따뜻한 세상',
  subheadline: '여러분의 후원이 변화를 만듭니다.',
  ctaText: '지금 후원하기',
  ctaUrl: '#campaigns',
  textAlign: 'center',
  stats: [
    { value: '1,200+', label: '누적 후원자' },
    { value: '₩3.2억', label: '누적 모금액' },
    { value: '5년', label: '활동 기간' },
  ],
})
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/landing-variants/hero-schemas.ts src/lib/landing-variants/hero-defaults.ts
git commit -m "feat(landing): hero 6 variants zod 스키마 + 기본값"
```

---

### Task 9: hero 컴포넌트 — HeroMinimal

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroMinimal.tsx`

- [ ] **Step 1: 구현**

```tsx
import type { HeroMinimalData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

interface Props { data: HeroMinimalData }

export function HeroMinimal({ data }: Props) {
  const { bgColor, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className={`max-w-4xl mx-auto px-6 py-24 flex flex-col ${align}`}>
        <MotionFadeUp>
          <h1 className="text-hero text-[var(--text)] mb-4">{headline}</h1>
        </MotionFadeUp>
        {subheadline && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mb-8 text-[var(--muted-foreground)]">{subheadline}</p>
          </MotionFadeUp>
        )}
        {ctaText && (
          <MotionFadeUp delay={0.2}>
            <a href={ctaUrl || '#'}
              className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
              style={{ boxShadow: 'var(--shadow-card)' }}>
              {ctaText}
            </a>
          </MotionFadeUp>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroMinimal.tsx
git commit -m "feat(landing): HeroMinimal variant"
```

---

### Task 10: hero 컴포넌트 — HeroSplitImage

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroSplitImage.tsx`

- [ ] **Step 1: 구현**

```tsx
import type { HeroSplitImageData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

interface Props { data: HeroSplitImageData }

export function HeroSplitImage({ data }: Props) {
  const { bgColor, rightImageUrl, imageRatio = '1:1', headline, subheadline, ctaText, ctaUrl } = data
  const aspect = imageRatio === '1:1' ? 'aspect-square' : imageRatio === '4:3' ? 'aspect-[4/3]' : 'aspect-[3/4]'

  return (
    <section className="relative border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-6xl mx-auto px-6 py-20 grid md:grid-cols-2 gap-10 items-center">
        <div className="order-2 md:order-1">
          <MotionFadeUp>
            <h1 className="text-hero text-[var(--text)] mb-4">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-base mb-8 text-[var(--muted-foreground)]">{subheadline}</p>
            </MotionFadeUp>
          )}
          {ctaText && (
            <MotionFadeUp delay={0.2}>
              <a href={ctaUrl || '#'}
                className="inline-flex items-center justify-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-opacity"
                style={{ boxShadow: 'var(--shadow-card)' }}>
                {ctaText}
              </a>
            </MotionFadeUp>
          )}
        </div>
        <MotionFadeUp delay={0.15} className={`order-1 md:order-2 ${aspect} overflow-hidden`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={rightImageUrl} alt="" className="w-full h-full object-cover"
            style={{ borderRadius: 'var(--radius-hero)', boxShadow: 'var(--shadow-hero)' }} />
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroSplitImage.tsx
git commit -m "feat(landing): HeroSplitImage variant"
```

---

### Task 11: hero 컴포넌트 — HeroFullscreenImage

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroFullscreenImage.tsx`

- [ ] **Step 1: 구현**

```tsx
import type { HeroFullscreenImageData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'

interface Props { data: HeroFullscreenImageData }

export function HeroFullscreenImage({ data }: Props) {
  const { bgImageUrl, overlayOpacity, kenBurns = true, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} enabled={kenBurns} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col justify-center">
        <div className={`flex flex-col ${align}`}>
          <MotionFadeUp>
            <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
            </MotionFadeUp>
          )}
          {ctaText && (
            <MotionFadeUp delay={0.2}>
              <a href={ctaUrl || '#'}
                className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-hero)' }}>
                {ctaText} →
              </a>
            </MotionFadeUp>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-white/60 text-xs animate-bounce" aria-hidden>
        ▼ 스크롤
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroFullscreenImage.tsx
git commit -m "feat(landing): HeroFullscreenImage variant (Ken Burns + 80vh)"
```

---

### Task 12: hero 컴포넌트 — HeroFullscreenVideo

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroFullscreenVideo.tsx`

- [ ] **Step 1: 구현**

```tsx
'use client'
import { useState } from 'react'
import type { HeroFullscreenVideoData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

interface Props { data: HeroFullscreenVideoData }

export function HeroFullscreenVideo({ data }: Props) {
  const { videoUrl, posterUrl, overlayOpacity, showMuteToggle, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const [muted, setMuted] = useState(true)
  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      <video
        className="absolute inset-0 w-full h-full object-cover"
        src={videoUrl}
        poster={posterUrl}
        autoPlay
        muted={muted}
        loop
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, rgba(10,10,15,${overlayOpacity / 100}), rgba(10,10,15,${Math.min(overlayOpacity / 100 + 0.3, 1)}))` }} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col justify-center">
        <div className={`flex flex-col ${align}`}>
          <MotionFadeUp>
            <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
            </MotionFadeUp>
          )}
          {ctaText && (
            <MotionFadeUp delay={0.2}>
              <a href={ctaUrl || '#'}
                className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-hero)' }}>
                {ctaText} →
              </a>
            </MotionFadeUp>
          )}
        </div>
      </div>
      {showMuteToggle && (
        <button
          type="button"
          onClick={() => setMuted((v) => !v)}
          aria-label={muted ? '소리 켜기' : '소리 끄기'}
          className="absolute bottom-6 right-6 z-20 rounded-full w-10 h-10 bg-black/40 text-white flex items-center justify-center hover:bg-black/60"
        >
          {muted ? '🔇' : '🔊'}
        </button>
      )}
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroFullscreenVideo.tsx
git commit -m "feat(landing): HeroFullscreenVideo variant"
```

---

### Task 13: hero 컴포넌트 — HeroGallery

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroGallery.tsx`

- [ ] **Step 1: 구현**

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import type { HeroGalleryData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

interface Props { data: HeroGalleryData }

export function HeroGallery({ data }: Props) {
  const { images, intervalMs, overlayOpacity, headline, subheadline, ctaText, ctaUrl, textAlign = 'center' } = data
  const [idx, setIdx] = useState(0)
  const reduce = useReducedMotion()

  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), intervalMs)
    return () => clearInterval(t)
  }, [images.length, intervalMs, reduce])

  const align = textAlign === 'left' ? 'text-left items-start'
    : textAlign === 'right' ? 'text-right items-end' : 'text-center items-center'

  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      {images.map((img, i) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={i} src={img.url} alt={img.alt}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000"
          style={{ opacity: i === idx ? 1 : 0 }} />
      ))}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `linear-gradient(to bottom, rgba(10,10,15,${overlayOpacity / 100}), rgba(10,10,15,${Math.min(overlayOpacity / 100 + 0.3, 1)}))` }} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col justify-center">
        <div className={`flex flex-col ${align}`}>
          <MotionFadeUp>
            <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
          </MotionFadeUp>
          {subheadline && (
            <MotionFadeUp delay={0.1}>
              <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
            </MotionFadeUp>
          )}
          {ctaText && (
            <MotionFadeUp delay={0.2}>
              <a href={ctaUrl || '#'}
                className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
                style={{ boxShadow: 'var(--shadow-hero)' }}>
                {ctaText} →
              </a>
            </MotionFadeUp>
          )}
        </div>
      </div>
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
        {images.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            aria-label={`슬라이드 ${i + 1}`}
            className="w-2 h-2 rounded-full transition-opacity"
            style={{ background: 'white', opacity: i === idx ? 1 : 0.4 }}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroGallery.tsx
git commit -m "feat(landing): HeroGallery variant (crossfade + reduced-motion safe)"
```

---

### Task 14: hero 컴포넌트 — HeroStatsOverlay

**Files:**
- Create: `src/components/landing-builder/sections/hero/HeroStatsOverlay.tsx`

- [ ] **Step 1: 구현**

```tsx
import type { HeroStatsOverlayData } from '@/lib/landing-variants/hero-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'
import { CountUp } from '../../shared/CountUp'

interface Props { data: HeroStatsOverlayData }

export function HeroStatsOverlay({ data }: Props) {
  const { bgImageUrl, overlayOpacity, kenBurns = true, headline, subheadline, ctaText, ctaUrl, stats } = data

  return (
    <section className="relative overflow-hidden min-h-[90vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} enabled={kenBurns} />
      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-32 pb-44 min-h-[90vh] flex flex-col justify-center text-center items-center">
        <MotionFadeUp>
          <h1 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h1>
        </MotionFadeUp>
        {subheadline && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mb-10 text-white/90">{subheadline}</p>
          </MotionFadeUp>
        )}
        {ctaText && (
          <MotionFadeUp delay={0.2}>
            <a href={ctaUrl || '#'}
              className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
              style={{ boxShadow: 'var(--shadow-hero)' }}>
              {ctaText} →
            </a>
          </MotionFadeUp>
        )}
      </div>
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/50 backdrop-blur-md border-t border-white/20">
        <div className="max-w-5xl mx-auto px-6 py-6 grid gap-6"
          style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4)}, minmax(0, 1fr))` }}>
          {stats.map((s, i) => (
            <div key={i} className="text-center text-white">
              <div className="text-3xl font-bold mb-1"><CountUp value={s.value} /></div>
              <div className="text-xs uppercase tracking-wider text-white/70">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/sections/hero/HeroStatsOverlay.tsx
git commit -m "feat(landing): HeroStatsOverlay variant (Ken Burns + bottom stats + countup)"
```

---

### Task 15: hero variant 레지스트리 등록

**Files:**
- Modify: `src/lib/landing-variants/hero.ts`

- [ ] **Step 1: 레지스트리 채우기**

```ts
import { registerVariants } from './index'
import * as S from './hero-schemas'
import * as D from './hero-defaults'

registerVariants('hero', [
  { id: 'hero-minimal', type: 'hero', label: '미니멀',
    description: '단색 배경 + 중앙 텍스트 + CTA. 단정하고 깔끔한 첫 인상.',
    preview: '/landing-variants/hero-minimal.svg', visualWeight: 'minimal',
    dataSchema: S.HeroMinimal, defaultData: D.heroMinimalDefault },
  { id: 'hero-split-image', type: 'hero', label: '분할 이미지',
    description: '좌측 텍스트+CTA / 우측 이미지 분할 레이아웃.',
    preview: '/landing-variants/hero-split-image.svg', visualWeight: 'bold',
    dataSchema: S.HeroSplitImage, defaultData: D.heroSplitImageDefault },
  { id: 'hero-fullscreen-image', type: 'hero', label: '풀스크린 이미지',
    description: '80vh 배경 이미지 + Ken Burns 애니메이션. 임팩트 강조.',
    preview: '/landing-variants/hero-fullscreen-image.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroFullscreenImage, defaultData: D.heroFullscreenImageDefault },
  { id: 'hero-fullscreen-video', type: 'hero', label: '풀스크린 비디오',
    description: '배경 영상 autoplay, 모바일은 포스터 이미지 fallback.',
    preview: '/landing-variants/hero-fullscreen-video.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroFullscreenVideo, defaultData: D.heroFullscreenVideoDefault },
  { id: 'hero-gallery', type: 'hero', label: '이미지 갤러리',
    description: '배경 이미지 여러 장이 crossfade로 전환. 활동 다양성 강조.',
    preview: '/landing-variants/hero-gallery.svg', visualWeight: 'cinematic',
    dataSchema: S.HeroGallery, defaultData: D.heroGalleryDefault },
  { id: 'hero-stats-overlay', type: 'hero', label: '통계 오버레이',
    description: '풀스크린 이미지 하단에 주요 지표 3~4개 오버레이.',
    preview: '/landing-variants/hero-stats-overlay.svg', visualWeight: 'bold',
    dataSchema: S.HeroStatsOverlay, defaultData: D.heroStatsOverlayDefault },
])
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/landing-variants/hero.ts
git commit -m "feat(landing): hero variants 레지스트리 등록"
```

---

## 3. CTA Variants (5개)

### Task 16: cta 스키마 + 기본값

**Files:**
- Create: `src/lib/landing-variants/cta-schemas.ts`
- Create: `src/lib/landing-variants/cta-defaults.ts`

- [ ] **Step 1: 스키마**

```ts
import { z } from 'zod'

export const CtaBase = z.object({
  headline: z.string().min(1).max(100),
  body: z.string().max(300).optional(),
  buttonText: z.string().min(1).max(40),
  buttonUrl: z.string().max(500).optional(),
})

export const CtaBanner = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
})

export const CtaGradient = CtaBase.extend({
  gradientFrom: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  gradientTo: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2563eb'),
})

export const CtaSplit = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  secondaryLabel: z.string().max(40).optional(),   // 예: "전화 문의"
  secondaryValue: z.string().max(80).optional(),   // 예: "02-123-4567"
})

export const CtaUrgency = CtaBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
  deadlineIso: z.string().datetime(),             // D-day 카운터 대상
  goalAmount: z.number().min(0).default(10_000_000),
  raisedAmount: z.number().min(0).default(0),
})

export const CtaFullscreen = CtaBase.extend({
  bgImageUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(55),
})

export type CtaBannerData = z.infer<typeof CtaBanner>
export type CtaGradientData = z.infer<typeof CtaGradient>
export type CtaSplitData = z.infer<typeof CtaSplit>
export type CtaUrgencyData = z.infer<typeof CtaUrgency>
export type CtaFullscreenData = z.infer<typeof CtaFullscreen>
```

- [ ] **Step 2: 기본값**

```ts
import type { CtaBannerData, CtaGradientData, CtaSplitData, CtaUrgencyData, CtaFullscreenData } from './cta-schemas'

export const ctaBannerDefault = (): CtaBannerData => ({
  bgColor: '#1a3a5c',
  headline: '지금 바로 후원에 동참하세요',
  body: '작은 후원이 큰 변화를 만듭니다.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})

export const ctaGradientDefault = (): CtaGradientData => ({
  gradientFrom: '#1a3a5c',
  gradientTo: '#2563eb',
  headline: '지금 바로 후원에 동참하세요',
  body: '작은 후원이 큰 변화를 만듭니다.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})

export const ctaSplitDefault = (): CtaSplitData => ({
  bgColor: '#1a3a5c',
  headline: '함께해 주세요',
  body: '여러분의 참여가 기관을 움직입니다.',
  buttonText: '지금 후원하기',
  buttonUrl: '#campaigns',
  secondaryLabel: '전화 문의',
  secondaryValue: '02-000-0000',
})

export const ctaUrgencyDefault = (): CtaUrgencyData => {
  const d = new Date()
  d.setDate(d.getDate() + 14)
  return {
    bgColor: '#1a3a5c',
    headline: '마감 임박! 함께해 주세요',
    body: '목표 달성까지 얼마 남지 않았습니다.',
    buttonText: '지금 후원하기',
    buttonUrl: '#campaigns',
    deadlineIso: d.toISOString(),
    goalAmount: 10_000_000,
    raisedAmount: 6_400_000,
  }
}

export const ctaFullscreenDefault = (): CtaFullscreenData => ({
  bgImageUrl: 'https://picsum.photos/seed/cta-fs/1920/1080',
  overlayOpacity: 55,
  headline: '당신의 손길이 필요합니다',
  body: '지금 바로 동참해 주세요.',
  buttonText: '후원하기',
  buttonUrl: '#campaigns',
})
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/landing-variants/cta-schemas.ts src/lib/landing-variants/cta-defaults.ts
git commit -m "feat(landing): cta 5 variants 스키마 + 기본값"
```

---

### Task 17: cta 컴포넌트들

**Files:**
- Create: `src/components/landing-builder/sections/cta/CtaBanner.tsx`
- Create: `src/components/landing-builder/sections/cta/CtaGradient.tsx`
- Create: `src/components/landing-builder/sections/cta/CtaSplit.tsx`
- Create: `src/components/landing-builder/sections/cta/CtaUrgency.tsx`
- Create: `src/components/landing-builder/sections/cta/CtaFullscreen.tsx`

- [ ] **Step 1: CtaBanner**

```tsx
import type { CtaBannerData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaBanner({ data }: { data: CtaBannerData }) {
  const { bgColor, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <MotionFadeUp>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mx-auto mb-8 text-white/85">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-10 py-3.5 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-card)' }}>
            {buttonText}
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: CtaGradient**

```tsx
import type { CtaGradientData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaGradient({ data }: { data: CtaGradientData }) {
  const { gradientFrom, gradientTo, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="border-b border-[var(--border)]"
      style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <MotionFadeUp>
          <h2 className="text-hero text-white mb-4 drop-shadow">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mx-auto mb-10 text-white/90">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-full px-12 py-4 text-lg font-bold text-[var(--accent)] bg-white hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: 'var(--shadow-hero)' }}>
            {buttonText} →
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: CtaSplit**

```tsx
import type { CtaSplitData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function CtaSplit({ data }: { data: CtaSplitData }) {
  const { bgColor, headline, body, buttonText, buttonUrl, secondaryLabel, secondaryValue } = data
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-5xl mx-auto px-6 py-16 grid md:grid-cols-[1fr_auto] gap-8 items-center">
        <div>
          <MotionFadeUp>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">{headline}</h2>
          </MotionFadeUp>
          {body && (
            <MotionFadeUp delay={0.1}>
              <p className="text-white/80 text-base">{body}</p>
            </MotionFadeUp>
          )}
        </div>
        <MotionFadeUp delay={0.2} className="flex flex-col items-start md:items-end gap-2">
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-8 py-3 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-card)' }}>
            {buttonText} →
          </a>
          {secondaryLabel && secondaryValue && (
            <div className="text-sm text-white/70">
              {secondaryLabel}: <span className="font-medium text-white">{secondaryValue}</span>
            </div>
          )}
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: CtaUrgency**

```tsx
'use client'
import { useEffect, useState } from 'react'
import type { CtaUrgencyData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

function formatKRW(n: number) { return new Intl.NumberFormat('ko-KR').format(n) + '원' }

function calcDdays(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
}

export function CtaUrgency({ data }: { data: CtaUrgencyData }) {
  const { bgColor, headline, body, buttonText, buttonUrl, deadlineIso, goalAmount, raisedAmount } = data
  const [ddays, setDdays] = useState<number | null>(null)

  useEffect(() => { setDdays(calcDdays(deadlineIso)) }, [deadlineIso])

  const pct = goalAmount > 0 ? Math.min(Math.round((raisedAmount / goalAmount) * 100), 100) : 0

  return (
    <section className="border-b border-[var(--border)]" style={{ background: bgColor }}>
      <div className="max-w-4xl mx-auto px-6 py-16 text-center">
        <MotionFadeUp>
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4 text-sm font-semibold text-white bg-[var(--negative)]/80">
            🔥 {ddays !== null && ddays >= 0 ? `D-${ddays}` : '마감'}
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-white">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-base max-w-2xl mx-auto mb-6 text-white/85">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.15}>
          <div className="max-w-md mx-auto mb-8">
            <div className="flex justify-between text-xs mb-2 text-white/80">
              <span>{formatKRW(raisedAmount)}</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden bg-white/20">
              <div className="h-full rounded-full bg-white transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="text-xs mt-1 text-right text-white/70">목표 {formatKRW(goalAmount)}</div>
          </div>
        </MotionFadeUp>
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-lg px-10 py-3.5 text-base font-semibold text-white bg-[var(--accent)] hover:opacity-90 transition-all hover:-translate-y-0.5"
            style={{ boxShadow: 'var(--shadow-hero)' }}>
            {buttonText} →
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: CtaFullscreen**

```tsx
import type { CtaFullscreenData } from '@/lib/landing-variants/cta-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { KenBurns } from '../../shared/KenBurns'

export function CtaFullscreen({ data }: { data: CtaFullscreenData }) {
  const { bgImageUrl, overlayOpacity, headline, body, buttonText, buttonUrl } = data
  return (
    <section className="relative overflow-hidden min-h-[80vh] border-b border-[var(--border)]">
      <KenBurns imageUrl={bgImageUrl} overlayOpacity={overlayOpacity} />
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-32 min-h-[80vh] flex flex-col items-center justify-center text-center">
        <MotionFadeUp>
          <h2 className="text-display text-white mb-6 drop-shadow-lg">{headline}</h2>
        </MotionFadeUp>
        {body && (
          <MotionFadeUp delay={0.1}>
            <p className="text-lg max-w-2xl mb-10 text-white/90">{body}</p>
          </MotionFadeUp>
        )}
        <MotionFadeUp delay={0.2}>
          <a href={buttonUrl || '#campaigns'}
            className="inline-flex items-center rounded-full px-12 py-4 text-lg font-bold text-[var(--accent)] bg-white hover:-translate-y-0.5 transition-all"
            style={{ boxShadow: 'var(--shadow-hero)' }}>
            {buttonText} →
          </a>
        </MotionFadeUp>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/components/landing-builder/sections/cta
git commit -m "feat(landing): cta 5 variants (banner/gradient/split/urgency/fullscreen)"
```

---

### Task 18: cta 레지스트리

**Files:**
- Modify: `src/lib/landing-variants/cta.ts`

- [ ] **Step 1: 등록**

```ts
import { registerVariants } from './index'
import * as S from './cta-schemas'
import * as D from './cta-defaults'

registerVariants('cta', [
  { id: 'cta-banner', type: 'cta', label: '배너',
    description: '단색 배경 + 중앙 버튼. 깔끔한 기본형.',
    preview: '/landing-variants/cta-banner.svg', visualWeight: 'minimal',
    dataSchema: S.CtaBanner, defaultData: D.ctaBannerDefault },
  { id: 'cta-gradient', type: 'cta', label: '그라디언트',
    description: '그라디언트 배경 + 대형 버튼. 시각적 강조.',
    preview: '/landing-variants/cta-gradient.svg', visualWeight: 'bold',
    dataSchema: S.CtaGradient, defaultData: D.ctaGradientDefault },
  { id: 'cta-split', type: 'cta', label: '좌우 분할',
    description: '좌측 메시지 / 우측 버튼 + 보조 정보(전화 등).',
    preview: '/landing-variants/cta-split.svg', visualWeight: 'bold',
    dataSchema: S.CtaSplit, defaultData: D.ctaSplitDefault },
  { id: 'cta-urgency', type: 'cta', label: '긴급 (D-day + 진행률)',
    description: 'D-day 카운터 + 목표 달성률. 마감 임박 강조.',
    preview: '/landing-variants/cta-urgency.svg', visualWeight: 'cinematic',
    dataSchema: S.CtaUrgency, defaultData: D.ctaUrgencyDefault },
  { id: 'cta-fullscreen', type: 'cta', label: '풀스크린',
    description: '80vh 이미지 배경 + 대형 버튼. 섹션 마지막 임팩트.',
    preview: '/landing-variants/cta-fullscreen.svg', visualWeight: 'cinematic',
    dataSchema: S.CtaFullscreen, defaultData: D.ctaFullscreenDefault },
])
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/landing-variants/cta.ts
git commit -m "feat(landing): cta variants 레지스트리 등록"
```

---

## 4. Stats Variants (5개)

### Task 19: stats 스키마 + 기본값

**Files:**
- Create: `src/lib/landing-variants/stats-schemas.ts`
- Create: `src/lib/landing-variants/stats-defaults.ts`

- [ ] **Step 1: 스키마**

```ts
import { z } from 'zod'

const StatItem = z.object({
  icon: z.string().max(4).optional(),     // emoji 1~2
  value: z.string().min(1).max(20),
  label: z.string().min(1).max(40),
})

export const StatsBase = z.object({
  title: z.string().max(100).optional(),
  items: z.array(StatItem).min(2).max(6),
})

export const StatsGrid = StatsBase
export const StatsInline = StatsBase
export const StatsCards = StatsBase
export const StatsCountup = StatsBase
export const StatsBig = StatsBase.extend({
  gradient: z.boolean().default(true),
})

export type StatsGridData = z.infer<typeof StatsGrid>
export type StatsInlineData = z.infer<typeof StatsInline>
export type StatsCardsData = z.infer<typeof StatsCards>
export type StatsCountupData = z.infer<typeof StatsCountup>
export type StatsBigData = z.infer<typeof StatsBig>
```

- [ ] **Step 2: 기본값**

```ts
import type { StatsGridData, StatsInlineData, StatsCardsData, StatsCountupData, StatsBigData } from './stats-schemas'

const baseItems = () => ([
  { icon: '👥', value: '1,200+', label: '누적 후원자' },
  { icon: '💰', value: '320,000,000', label: '누적 모금액 (원)' },
  { icon: '📋', value: '24', label: '진행 캠페인' },
  { icon: '🌱', value: '5', label: '활동 연차' },
])

export const statsGridDefault = (): StatsGridData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsInlineDefault = (): StatsInlineData => ({ title: '', items: baseItems() })
export const statsCardsDefault = (): StatsCardsData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsCountupDefault = (): StatsCountupData => ({ title: '우리가 만든 변화', items: baseItems() })
export const statsBigDefault = (): StatsBigData => ({ title: '우리의 영향력', items: baseItems().slice(0, 3), gradient: true })
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/landing-variants/stats-schemas.ts src/lib/landing-variants/stats-defaults.ts
git commit -m "feat(landing): stats 5 variants 스키마 + 기본값"
```

---

### Task 20: stats 컴포넌트들

**Files:**
- Create: `src/components/landing-builder/sections/stats/StatsGrid.tsx`
- Create: `src/components/landing-builder/sections/stats/StatsInline.tsx`
- Create: `src/components/landing-builder/sections/stats/StatsCards.tsx`
- Create: `src/components/landing-builder/sections/stats/StatsCountup.tsx`
- Create: `src/components/landing-builder/sections/stats/StatsBig.tsx`

- [ ] **Step 1: StatsGrid (`{type}-default` 마이그레이션)**

```tsx
import type { StatsGridData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsGrid({ data }: { data: StatsGridData }) {
  const { title, items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-4xl mx-auto px-6 py-14 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-8" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <div className="flex flex-col items-center gap-2">
                {it.icon && <span className="text-3xl">{it.icon}</span>}
                <div className="text-3xl font-bold text-[var(--accent)]">{it.value}</div>
                <div className="text-sm text-[var(--muted-foreground)]">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: StatsInline**

```tsx
import type { StatsInlineData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsInline({ data }: { data: StatsInlineData }) {
  const { items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex flex-wrap justify-around items-center gap-4 divide-x divide-[var(--border)]">
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.05} className="flex items-center gap-3 px-4">
              {it.icon && <span className="text-xl">{it.icon}</span>}
              <span className="text-xl font-bold text-[var(--accent)]">{it.value}</span>
              <span className="text-sm text-[var(--muted-foreground)]">{it.label}</span>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: StatsCards**

```tsx
import type { StatsCardsData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'

export function StatsCards({ data }: { data: StatsCardsData }) {
  const { title, items } = data
  return (
    <section className="border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-10 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(180px, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.06}>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 transition-transform hover:-translate-y-1"
                style={{ boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-card)' }}>
                {it.icon && <div className="text-3xl mb-2">{it.icon}</div>}
                <div className="text-3xl font-bold text-[var(--accent)] mb-1">{it.value}</div>
                <div className="text-xs uppercase tracking-wider text-[var(--muted-foreground)]">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: StatsCountup**

```tsx
import type { StatsCountupData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { CountUp } from '../../shared/CountUp'

export function StatsCountup({ data }: { data: StatsCountupData }) {
  const { title, items } = data
  return (
    <section className="bg-[var(--surface)] border-b border-[var(--border)]">
      <div className="max-w-5xl mx-auto px-6 py-16 text-center">
        {title && <MotionFadeUp><h2 className="text-2xl font-bold mb-12 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-10" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.08}>
              <div className="flex flex-col items-center gap-2">
                {it.icon && <span className="text-4xl mb-2">{it.icon}</span>}
                <div className="text-5xl font-bold text-[var(--accent)]"><CountUp value={it.value} /></div>
                <div className="text-sm text-[var(--muted-foreground)] mt-2">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 5: StatsBig**

```tsx
import type { StatsBigData } from '@/lib/landing-variants/stats-schemas'
import { MotionFadeUp } from '../../shared/MotionWrapper'
import { CountUp } from '../../shared/CountUp'

export function StatsBig({ data }: { data: StatsBigData }) {
  const { title, items, gradient } = data
  const bg = gradient ? 'var(--gradient-soft)' : 'var(--surface)'
  return (
    <section className="border-b border-[var(--border)]" style={{ background: bg }}>
      <div className="max-w-6xl mx-auto px-6 py-24 text-center">
        {title && <MotionFadeUp><h2 className="text-3xl font-bold mb-16 text-[var(--text)]">{title}</h2></MotionFadeUp>}
        <div className="grid gap-12" style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 3)}, minmax(0, 1fr))` }}>
          {items.map((it, i) => (
            <MotionFadeUp key={i} delay={i * 0.1}>
              <div className="flex flex-col items-center">
                <div className="text-display text-[var(--accent)]"><CountUp value={it.value} /></div>
                <div className="text-base text-[var(--muted-foreground)] mt-4 uppercase tracking-wider">{it.label}</div>
              </div>
            </MotionFadeUp>
          ))}
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 6: 커밋**

```bash
git add src/components/landing-builder/sections/stats
git commit -m "feat(landing): stats 5 variants (grid/inline/cards/countup/big)"
```

---

### Task 21: stats 레지스트리

**Files:**
- Modify: `src/lib/landing-variants/stats.ts`

- [ ] **Step 1: 등록**

```ts
import { registerVariants } from './index'
import * as S from './stats-schemas'
import * as D from './stats-defaults'

registerVariants('stats', [
  { id: 'stats-grid', type: 'stats', label: '그리드',
    description: '가로 4열 그리드. 현재 기본 레이아웃.',
    preview: '/landing-variants/stats-grid.svg', visualWeight: 'minimal',
    dataSchema: S.StatsGrid, defaultData: D.statsGridDefault },
  { id: 'stats-inline', type: 'stats', label: '한 줄',
    description: '가로 1줄 인라인. 낮은 높이로 섹션 사이 삽입.',
    preview: '/landing-variants/stats-inline.svg', visualWeight: 'minimal',
    dataSchema: S.StatsInline, defaultData: D.statsInlineDefault },
  { id: 'stats-cards', type: 'stats', label: '카드',
    description: '카드 형태 + hover 리프트. 시각적 분리.',
    preview: '/landing-variants/stats-cards.svg', visualWeight: 'bold',
    dataSchema: S.StatsCards, defaultData: D.statsCardsDefault },
  { id: 'stats-countup', type: 'stats', label: '카운트업',
    description: '스크롤 진입 시 숫자 0→N 애니메이션.',
    preview: '/landing-variants/stats-countup.svg', visualWeight: 'bold',
    dataSchema: S.StatsCountup, defaultData: D.statsCountupDefault },
  { id: 'stats-big', type: 'stats', label: '대형 숫자',
    description: '거대 display 타이포 + 그라디언트 배경. 최대 임팩트.',
    preview: '/landing-variants/stats-big.svg', visualWeight: 'cinematic',
    dataSchema: S.StatsBig, defaultData: D.statsBigDefault },
])
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/landing-variants/stats.ts
git commit -m "feat(landing): stats variants 레지스트리 등록"
```

---

## 5. LandingRenderer — variant dispatch

### Task 22: VARIANT_COMPONENTS 레지스트리

**Files:**
- Create: `src/components/landing-builder/variant-components.tsx`

- [ ] **Step 1: 매핑**

```tsx
import type { ComponentType } from 'react'

// hero
import { HeroMinimal } from './sections/hero/HeroMinimal'
import { HeroSplitImage } from './sections/hero/HeroSplitImage'
import { HeroFullscreenImage } from './sections/hero/HeroFullscreenImage'
import { HeroFullscreenVideo } from './sections/hero/HeroFullscreenVideo'
import { HeroGallery } from './sections/hero/HeroGallery'
import { HeroStatsOverlay } from './sections/hero/HeroStatsOverlay'

// cta
import { CtaBanner } from './sections/cta/CtaBanner'
import { CtaGradient } from './sections/cta/CtaGradient'
import { CtaSplit } from './sections/cta/CtaSplit'
import { CtaUrgency } from './sections/cta/CtaUrgency'
import { CtaFullscreen } from './sections/cta/CtaFullscreen'

// stats
import { StatsGrid } from './sections/stats/StatsGrid'
import { StatsInline } from './sections/stats/StatsInline'
import { StatsCards } from './sections/stats/StatsCards'
import { StatsCountup } from './sections/stats/StatsCountup'
import { StatsBig } from './sections/stats/StatsBig'

// 기존 섹션(아직 variant 없음) — legacy 렌더러 재사용
import { ImpactSection } from './sections/ImpactSection'
import { CampaignsSection } from './sections/CampaignsSection'
import { DonationTiersSection } from './sections/DonationTiersSection'
import { TeamSection } from './sections/TeamSection'
import { RichtextSection } from './sections/RichtextSection'

export const VARIANT_COMPONENTS: Record<string, ComponentType<{ data: any; campaigns?: any }>> = {
  // hero
  'hero-minimal': HeroMinimal,
  'hero-split-image': HeroSplitImage,
  'hero-fullscreen-image': HeroFullscreenImage,
  'hero-fullscreen-video': HeroFullscreenVideo,
  'hero-gallery': HeroGallery,
  'hero-stats-overlay': HeroStatsOverlay,
  // cta
  'cta-banner': CtaBanner,
  'cta-gradient': CtaGradient,
  'cta-split': CtaSplit,
  'cta-urgency': CtaUrgency,
  'cta-fullscreen': CtaFullscreen,
  // stats
  'stats-grid': StatsGrid,
  'stats-inline': StatsInline,
  'stats-cards': StatsCards,
  'stats-countup': StatsCountup,
  'stats-big': StatsBig,
  // legacy (Phase B~D 변환 예정)
  'impact-alternating': ImpactSection,
  'campaigns-grid': CampaignsSection,
  'tiers-cards': DonationTiersSection,
  'team-grid': TeamSection,
  'richtext-plain': RichtextSection,
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/variant-components.tsx
git commit -m "feat(landing): VARIANT_COMPONENTS 레지스트리 (Phase A 16 + legacy 5)"
```

---

### Task 23: LandingRenderer 수정

**Files:**
- Modify: `src/components/landing-builder/LandingRenderer.tsx`

- [ ] **Step 1: variant dispatch 로 교체**

```tsx
import type { LandingSection } from '@/types/landing'
import { VARIANT_COMPONENTS } from './variant-components'

interface CampaignRow {
  id: string
  title: string
  slug: string
  description: string | null
  goal_amount: number | null
  ended_at: string | null
  thumbnail_url: string | null
  raised: number
}

interface Props {
  sections: LandingSection[]
  campaigns?: CampaignRow[]
}

function renderSection(section: LandingSection, campaigns: CampaignRow[]) {
  const Component = VARIANT_COMPONENTS[section.variant]
  if (!Component) {
    return (
      <section key={section.id} className="border-b border-[var(--border)] bg-[var(--surface-2)] py-12 text-center">
        <p className="text-sm text-[var(--muted-foreground)]">
          알 수 없는 섹션 variant: <code>{section.variant}</code>
        </p>
      </section>
    )
  }
  if (section.type === 'campaigns') {
    return <Component key={section.id} data={section.data} campaigns={campaigns} />
  }
  return <Component key={section.id} data={section.data} />
}

export function LandingRenderer({ sections, campaigns = [] }: Props) {
  const visible = [...sections]
    .filter((s) => s.isVisible)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  return <>{visible.map((section) => renderSection(section, campaigns))}</>
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/LandingRenderer.tsx
git commit -m "refactor(landing): LandingRenderer variant dispatch"
```

---

## 6. 3단계 에디터 UX

### Task 24: Variant 갤러리 모달

**Files:**
- Create: `src/components/landing-builder/VariantGalleryModal.tsx`

- [ ] **Step 1: 구현**

```tsx
'use client'
import { useState } from 'react'
import type { LandingSectionType } from '@/types/landing'
import { getVariants } from '@/lib/landing-variants'
import type { VisualWeight } from '@/lib/landing-variants/types'

interface Props {
  type: LandingSectionType
  currentVariantId?: string
  onSelect: (variantId: string) => void
  onClose: () => void
}

const WEIGHT_LABEL: Record<VisualWeight, string> = {
  minimal: '미니멀',
  bold: '강조',
  cinematic: '시네마틱',
}

const WEIGHT_COLOR: Record<VisualWeight, string> = {
  minimal: 'var(--muted-foreground)',
  bold: 'var(--accent)',
  cinematic: 'var(--negative)',
}

export function VariantGalleryModal({ type, currentVariantId, onSelect, onClose }: Props) {
  const variants = getVariants(type)
  const [filter, setFilter] = useState<'all' | VisualWeight>('all')
  const filtered = filter === 'all' ? variants : variants.filter((v) => v.visualWeight === filter)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-lg border flex flex-col overflow-hidden"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">Variant 선택</p>
            <h3 className="text-base font-semibold text-[var(--text)] mt-0.5">{type} · {variants.length}개 중 선택</h3>
          </div>
          <button type="button" onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--text)] text-lg">✕</button>
        </div>
        <div className="px-5 py-3 flex gap-2 border-b border-[var(--border)]">
          {(['all', 'minimal', 'bold', 'cinematic'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="rounded-full px-3 py-1 text-xs font-medium border transition-colors"
              style={{
                background: filter === k ? 'var(--accent)' : 'var(--surface-2)',
                color: filter === k ? '#fff' : 'var(--muted-foreground)',
                borderColor: filter === k ? 'var(--accent)' : 'var(--border)',
              }}>
              {k === 'all' ? '전체' : WEIGHT_LABEL[k]}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filtered.map((v) => {
            const active = v.id === currentVariantId
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v.id)}
                className="text-left rounded-lg border overflow-hidden transition-all hover:-translate-y-0.5"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: active ? 'var(--accent)' : 'var(--border)',
                  boxShadow: active ? '0 0 0 3px color-mix(in oklch, var(--accent), transparent 70%)' : 'var(--shadow-card)',
                }}>
                <div className="aspect-[3/2] bg-[var(--bg)] flex items-center justify-center text-xs text-[var(--muted-foreground)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.preview} alt={v.label} className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                </div>
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-[var(--text)]">{v.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'color-mix(in oklch, currentColor, transparent 85%)', color: WEIGHT_COLOR[v.visualWeight] }}>
                      {WEIGHT_LABEL[v.visualWeight]}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)] line-clamp-2">{v.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/landing-builder/VariantGalleryModal.tsx
git commit -m "feat(landing): VariantGalleryModal (Step 2 UI)"
```

---

### Task 25: Editor에서 3단계 플로우 도입

**Files:**
- Modify: `src/components/landing-builder/LandingSectionEditor.tsx`

- [ ] **Step 1: 섹션 추가 플로우를 `선택 타입 → variant 갤러리`로**

`handleAdd` 를 직접 호출하는 카탈로그 버튼의 동작을 변경합니다.
파일 상단에 import 추가:

```tsx
import { VariantGalleryModal } from './VariantGalleryModal'
import { getVariants } from '@/lib/landing-variants'
```

state 추가 (기존 `showCatalog`, `editingId` 옆):

```tsx
const [pickingVariantFor, setPickingVariantFor] = useState<LandingSectionType | null>(null)
```

`handleAdd` 를 두 단계로 분리:

```tsx
function handlePickType(type: LandingSectionType) {
  setShowCatalog(false)
  setPickingVariantFor(type)
}

function handleAddWithVariant(type: LandingSectionType, variantId: string) {
  const newSection = createSection(type, sections.length)
  newSection.variant = variantId
  const variant = getVariants(type).find((v) => v.id === variantId)
  if (variant) newSection.data = variant.defaultData() as typeof newSection.data
  const updated = [...sections, newSection]
  setSections(updated)
  setPickingVariantFor(null)
  setEditingId(newSection.id)
  scheduleSave(updated)
}
```

카탈로그 버튼 `onClick` 을 `handlePickType(item.type)` 로 변경. (기존 `handleAdd` 호출 모두 교체)

JSX 최하단에 모달 추가:

```tsx
{pickingVariantFor && (
  <VariantGalleryModal
    type={pickingVariantFor}
    onSelect={(variantId) => handleAddWithVariant(pickingVariantFor, variantId)}
    onClose={() => setPickingVariantFor(null)}
  />
)}
```

- [ ] **Step 2: 추천 템플릿 버튼도 variant 지정하도록 수정**

기존 G-44 템플릿 버튼의 `createSection(type, i)` 후에 `.variant` 를 명시:

```tsx
onClick={() => {
  const template: LandingSectionType[] = ['hero', 'campaigns', 'cta']
  const added = template.map((type, i) => {
    const s = createSection(type, i)
    // createSection에서 이미 기본 variant 세팅됨. 강화 템플릿이면 아래처럼 override 가능:
    if (type === 'hero') s.variant = 'hero-fullscreen-image'
    if (type === 'cta') s.variant = 'cta-gradient'
    const variant = getVariants(type).find((v) => v.id === s.variant)
    if (variant) s.data = variant.defaultData() as typeof s.data
    return s
  })
  setSections(added)
  scheduleSave(added)
  setEditingId(added[0].id)
}}
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/landing-builder/LandingSectionEditor.tsx
git commit -m "feat(landing): 에디터 섹션 추가를 3단계(type → variant → data) 플로우로"
```

---

### Task 26: SettingsSheet에 Variant 전환 버튼

**Files:**
- Modify: `src/components/landing-builder/LandingSectionSettingsSheet.tsx`
- Modify: `src/components/landing-builder/LandingSectionEditor.tsx`

- [ ] **Step 1: SettingsSheet props 확장**

`LandingSectionSettingsSheet.tsx` 의 `Props` 에 추가:

```ts
interface Props {
  section: LandingSection
  open: boolean
  onClose: () => void
  onSave: (id: string, data: LandingSection['data']) => void
  onRequestVariantChange: () => void   // NEW
}
```

시트 헤더 바로 아래, 폼 영역 상단에 버튼 박스 추가:

```tsx
<div className="px-5 pt-3 -mt-1">
  <button
    type="button"
    onClick={onRequestVariantChange}
    className="w-full rounded-md border border-dashed border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs text-[var(--muted-foreground)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors"
  >
    🎨 Variant 전환 (현재: {section.variant})
  </button>
</div>
```

- [ ] **Step 2: Editor에서 전환 플로우 핸들러**

`LandingSectionEditor.tsx` 에 state/핸들러 추가:

```tsx
const [variantChangeFor, setVariantChangeFor] = useState<string | null>(null) // sectionId

function handleVariantChange(sectionId: string, newVariantId: string) {
  const section = sections.find((s) => s.id === sectionId)
  if (!section) return
  const variant = getVariants(section.type).find((v) => v.id === newVariantId)
  if (!variant) return

  const shared = SHARED_FIELDS[section.type]
  const newDefault = variant.defaultData() as Record<string, unknown>
  const oldData = section.data as Record<string, unknown>
  const merged: Record<string, unknown> = { ...newDefault }
  for (const key of shared) {
    if (oldData[key] !== undefined) merged[key] = oldData[key]
  }

  const updated = sections.map((s) =>
    s.id === sectionId ? { ...s, variant: newVariantId, data: merged as typeof s.data } : s
  )
  setSections(updated)
  scheduleSave(updated)
  setVariantChangeFor(null)
}
```

상단 import:

```tsx
import { SHARED_FIELDS } from '@/types/landing'
```

`editingSection` 렌더링 지점의 SettingsSheet 에 prop 전달:

```tsx
{editingSection && (
  <LandingSectionSettingsSheet
    section={editingSection}
    open={!!editingId}
    onClose={() => setEditingId(null)}
    onSave={handleSaveSection}
    onRequestVariantChange={() => setVariantChangeFor(editingSection.id)}
  />
)}

{variantChangeFor && (() => {
  const target = sections.find((s) => s.id === variantChangeFor)
  if (!target) return null
  return (
    <VariantGalleryModal
      type={target.type}
      currentVariantId={target.variant}
      onSelect={(variantId) => {
        if (variantId === target.variant) { setVariantChangeFor(null); return }
        if (!confirm(`Variant를 바꾸면 전용 입력값이 초기화됩니다.\n유지: ${SHARED_FIELDS[target.type].join(', ')}\n계속하시겠습니까?`)) {
          return
        }
        handleVariantChange(variantChangeFor, variantId)
      }}
      onClose={() => setVariantChangeFor(null)}
    />
  )
})()}
```

- [ ] **Step 3: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/landing-builder/LandingSectionSettingsSheet.tsx src/components/landing-builder/LandingSectionEditor.tsx
git commit -m "feat(landing): SettingsSheet에 Variant 전환 버튼 + 공통 필드 보존"
```

---

### Task 27: SettingsSheet — variant별 폼 동적 렌더

**Files:**
- Modify: `src/components/landing-builder/LandingSectionSettingsSheet.tsx`

현재 SettingsSheet는 `section.type` 기준으로만 form을 분기하고 있어 **Phase A에서 새로 추가된 variant-specific 필드(예: hero-fullscreen-image의 bgImageUrl, cta-urgency의 deadlineIso)를 편집할 수 없습니다**. variant 기준 분기를 추가합니다.

- [ ] **Step 1: hero variant 폼 분기**

`HeroForm` 을 `HeroMinimalForm`, `HeroSplitImageForm`, `HeroFullscreenImageForm`, `HeroFullscreenVideoForm`, `HeroGalleryForm`, `HeroStatsOverlayForm` 로 분할합니다. 공통 필드(headline, subheadline, ctaText, ctaUrl, textAlign)는 `HeroSharedFields` 헬퍼로 추출해 재사용.

섹션 타입 분기 부분(`section.type === 'hero' && ...`)을 variant 분기로 변경:

```tsx
{section.type === 'hero' && section.variant === 'hero-minimal' && (
  <HeroMinimalForm data={data as HeroMinimalData} onChange={setData} />
)}
{section.type === 'hero' && section.variant === 'hero-split-image' && (
  <HeroSplitImageForm data={data as HeroSplitImageData} onChange={setData} />
)}
// ... 나머지 4 variant
```

각 form 컴포넌트 전체 코드:

```tsx
import type {
  HeroMinimalData, HeroSplitImageData, HeroFullscreenImageData,
  HeroFullscreenVideoData, HeroGalleryData, HeroStatsOverlayData,
} from '@/lib/landing-variants/hero-schemas'

function HeroSharedFields<T extends {
  headline: string; subheadline?: string; ctaText?: string; ctaUrl?: string;
  textAlign?: 'left' | 'center' | 'right'
}>({ data, onChange }: { data: T; onChange: (d: T) => void }) {
  const p = (partial: Partial<T>) => onChange({ ...data, ...partial })
  return (
    <>
      <Field label="헤드라인"><input className={inputCls} value={data.headline} onChange={(e) => p({ headline: e.target.value } as Partial<T>)} /></Field>
      <Field label="서브 헤드라인"><input className={inputCls} value={data.subheadline ?? ''} onChange={(e) => p({ subheadline: e.target.value } as Partial<T>)} /></Field>
      <Field label="CTA 버튼 텍스트"><input className={inputCls} value={data.ctaText ?? ''} onChange={(e) => p({ ctaText: e.target.value } as Partial<T>)} /></Field>
      <Field label="CTA 버튼 URL"><input className={inputCls} value={data.ctaUrl ?? ''} onChange={(e) => p({ ctaUrl: e.target.value } as Partial<T>)} placeholder="#campaigns" /></Field>
      <Field label="텍스트 정렬">
        <select title="텍스트 정렬" className={inputCls} value={data.textAlign ?? 'center'}
          onChange={(e) => p({ textAlign: e.target.value as 'left'|'center'|'right' } as Partial<T>)}>
          <option value="left">왼쪽</option>
          <option value="center">가운데</option>
          <option value="right">오른쪽</option>
        </select>
      </Field>
    </>
  )
}

function HeroMinimalForm({ data, onChange }: { data: HeroMinimalData; onChange: (d: HeroMinimalData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} placeholder="#1a3a5c" /></Field>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

function HeroSplitImageForm({ data, onChange }: { data: HeroSplitImageData; onChange: (d: HeroSplitImageData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="우측 이미지"><ImageUploadField value={data.rightImageUrl} onChange={(url) => onChange({ ...data, rightImageUrl: url })} /></Field>
    <Field label="이미지 비율">
      <select title="비율" className={inputCls} value={data.imageRatio}
        onChange={(e) => onChange({ ...data, imageRatio: e.target.value as '1:1'|'4:3'|'3:4' })}>
        <option value="1:1">1:1</option><option value="4:3">4:3</option><option value="3:4">3:4</option>
      </select>
    </Field>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

function HeroFullscreenImageForm({ data, onChange }: { data: HeroFullscreenImageData; onChange: (d: HeroFullscreenImageData) => void }) {
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.kenBurns} onChange={(e) => onChange({ ...data, kenBurns: e.target.checked })} className="accent-[var(--accent)]" />
      Ken Burns 애니메이션
    </label>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

function HeroFullscreenVideoForm({ data, onChange }: { data: HeroFullscreenVideoData; onChange: (d: HeroFullscreenVideoData) => void }) {
  return <>
    <Field label="비디오 URL (mp4/webm)"><input className={inputCls} value={data.videoUrl} onChange={(e) => onChange({ ...data, videoUrl: e.target.value })} placeholder="https://..." /></Field>
    <Field label="포스터 이미지 (모바일 fallback)"><ImageUploadField value={data.posterUrl} onChange={(url) => onChange({ ...data, posterUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.showMuteToggle} onChange={(e) => onChange({ ...data, showMuteToggle: e.target.checked })} className="accent-[var(--accent)]" />
      음소거 토글 버튼 표시
    </label>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

function HeroGalleryForm({ data, onChange }: { data: HeroGalleryData; onChange: (d: HeroGalleryData) => void }) {
  function updateImg(i: number, partial: Partial<HeroGalleryData['images'][0]>) {
    onChange({ ...data, images: data.images.map((im, idx) => idx === i ? { ...im, ...partial } : im) })
  }
  function addImg() { onChange({ ...data, images: [...data.images, { url: '', alt: '' }] }) }
  function removeImg(i: number) { onChange({ ...data, images: data.images.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <Field label="슬라이드 간격 (ms, 3000~15000)">
      <input type="number" className={inputCls} min={3000} max={15000} value={data.intervalMs}
        onChange={(e) => onChange({ ...data, intervalMs: Number(e.target.value) })} />
    </Field>
    {data.images.map((img, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">이미지 {i + 1}</span>
          <button type="button" onClick={() => removeImg(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="이미지"><ImageUploadField value={img.url} onChange={(url) => updateImg(i, { url })} /></Field>
        <Field label="대체 텍스트 (alt, 필수)"><input className={inputCls} value={img.alt} onChange={(e) => updateImg(i, { alt: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addImg} className={addBtnCls}>+ 이미지 추가</button>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}

function HeroStatsOverlayForm({ data, onChange }: { data: HeroStatsOverlayData; onChange: (d: HeroStatsOverlayData) => void }) {
  function updateStat(i: number, partial: Partial<HeroStatsOverlayData['stats'][0]>) {
    onChange({ ...data, stats: data.stats.map((s, idx) => idx === i ? { ...s, ...partial } : s) })
  }
  function addStat() { onChange({ ...data, stats: [...data.stats, { value: '0', label: '항목' }] }) }
  function removeStat(i: number) { onChange({ ...data, stats: data.stats.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.kenBurns} onChange={(e) => onChange({ ...data, kenBurns: e.target.checked })} className="accent-[var(--accent)]" />
      Ken Burns 애니메이션
    </label>
    {data.stats.map((s, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">통계 {i + 1}</span>
          <button type="button" onClick={() => removeStat(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="값"><input className={inputCls} value={s.value} onChange={(e) => updateStat(i, { value: e.target.value })} placeholder="1,200+" /></Field>
        <Field label="라벨"><input className={inputCls} value={s.label} onChange={(e) => updateStat(i, { label: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addStat} className={addBtnCls}>+ 통계 추가</button>
    <HeroSharedFields data={data} onChange={onChange} />
  </>
}
```

기존 `HeroForm` 함수는 삭제.

- [ ] **Step 2: cta variant 폼 분기**

같은 패턴으로 5개 form 추가. 공통 필드(headline/body/buttonText/buttonUrl)는 `CtaSharedFields`.

```tsx
import type { CtaBannerData, CtaGradientData, CtaSplitData, CtaUrgencyData, CtaFullscreenData } from '@/lib/landing-variants/cta-schemas'

function CtaSharedFields<T extends { headline: string; body?: string; buttonText: string; buttonUrl?: string }>({
  data, onChange,
}: { data: T; onChange: (d: T) => void }) {
  const p = (partial: Partial<T>) => onChange({ ...data, ...partial })
  return <>
    <Field label="헤드라인"><input className={inputCls} value={data.headline} onChange={(e) => p({ headline: e.target.value } as Partial<T>)} /></Field>
    <Field label="본문"><textarea className={textareaCls} value={data.body ?? ''} onChange={(e) => p({ body: e.target.value } as Partial<T>)} /></Field>
    <Field label="버튼 텍스트"><input className={inputCls} value={data.buttonText} onChange={(e) => p({ buttonText: e.target.value } as Partial<T>)} /></Field>
    <Field label="버튼 URL"><input className={inputCls} value={data.buttonUrl ?? ''} onChange={(e) => p({ buttonUrl: e.target.value } as Partial<T>)} placeholder="#campaigns" /></Field>
  </>
}

function CtaBannerForm({ data, onChange }: { data: CtaBannerData; onChange: (d: CtaBannerData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

function CtaGradientForm({ data, onChange }: { data: CtaGradientData; onChange: (d: CtaGradientData) => void }) {
  return <>
    <Field label="그라디언트 시작 (hex)"><input className={inputCls} value={data.gradientFrom} onChange={(e) => onChange({ ...data, gradientFrom: e.target.value })} /></Field>
    <Field label="그라디언트 끝 (hex)"><input className={inputCls} value={data.gradientTo} onChange={(e) => onChange({ ...data, gradientTo: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

function CtaSplitForm({ data, onChange }: { data: CtaSplitData; onChange: (d: CtaSplitData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="보조 라벨 (예: 전화 문의)"><input className={inputCls} value={data.secondaryLabel ?? ''} onChange={(e) => onChange({ ...data, secondaryLabel: e.target.value })} /></Field>
    <Field label="보조 값 (예: 02-000-0000)"><input className={inputCls} value={data.secondaryValue ?? ''} onChange={(e) => onChange({ ...data, secondaryValue: e.target.value })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

function CtaUrgencyForm({ data, onChange }: { data: CtaUrgencyData; onChange: (d: CtaUrgencyData) => void }) {
  return <>
    <Field label="배경 색상 (hex)"><input className={inputCls} value={data.bgColor} onChange={(e) => onChange({ ...data, bgColor: e.target.value })} /></Field>
    <Field label="마감일 (ISO datetime)"><input className={inputCls} type="datetime-local" value={data.deadlineIso.slice(0, 16)}
      onChange={(e) => onChange({ ...data, deadlineIso: new Date(e.target.value).toISOString() })} /></Field>
    <Field label="목표 금액 (원)"><input type="number" className={inputCls} min={0} value={data.goalAmount}
      onChange={(e) => onChange({ ...data, goalAmount: Number(e.target.value) })} /></Field>
    <Field label="현재 모금액 (원)"><input type="number" className={inputCls} min={0} value={data.raisedAmount}
      onChange={(e) => onChange({ ...data, raisedAmount: Number(e.target.value) })} /></Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}

function CtaFullscreenForm({ data, onChange }: { data: CtaFullscreenData; onChange: (d: CtaFullscreenData) => void }) {
  return <>
    <Field label="배경 이미지"><ImageUploadField value={data.bgImageUrl} onChange={(url) => onChange({ ...data, bgImageUrl: url })} /></Field>
    <Field label="오버레이 불투명도 (30-100)">
      <input type="number" className={inputCls} min={30} max={100} value={data.overlayOpacity}
        onChange={(e) => onChange({ ...data, overlayOpacity: Number(e.target.value) })} />
    </Field>
    <CtaSharedFields data={data} onChange={onChange} />
  </>
}
```

기존 `CtaForm` 삭제. 섹션 분기도 variant 기준으로:

```tsx
{section.type === 'cta' && section.variant === 'cta-banner' && (
  <CtaBannerForm data={data as CtaBannerData} onChange={setData} />
)}
// ... 나머지 4
```

- [ ] **Step 3: stats variant 폼 분기**

5개 variant 모두 동일 스키마(StatsBase + StatsBig만 gradient 추가)라 기존 `StatsForm` 재사용 + `StatsBig`만 `gradient` 체크박스 추가.

```tsx
{section.type === 'stats' && section.variant !== 'stats-big' && (
  <StatsForm data={data as StatsGridData} onChange={setData} />
)}
{section.type === 'stats' && section.variant === 'stats-big' && (
  <StatsBigForm data={data as StatsBigData} onChange={setData} />
)}
```

```tsx
function StatsBigForm({ data, onChange }: { data: StatsBigData; onChange: (d: StatsBigData) => void }) {
  // StatsForm 본문을 복제 + 끝에 gradient 체크박스 추가
  function updateItem(i: number, partial: Partial<StatsBigData['items'][0]>) {
    const items = data.items.map((it, idx) => idx === i ? { ...it, ...partial } : it)
    onChange({ ...data, items })
  }
  function addItem() { onChange({ ...data, items: [...data.items, { icon: '✨', value: '0', label: '항목' }] }) }
  function removeItem(i: number) { onChange({ ...data, items: data.items.filter((_, idx) => idx !== i) }) }
  return <>
    <Field label="섹션 제목"><input className={inputCls} value={data.title ?? ''} onChange={(e) => onChange({ ...data, title: e.target.value })} /></Field>
    {data.items.map((item, i) => (
      <div key={i} className={repeatGroupCls}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--muted-foreground)]">항목 {i + 1}</span>
          <button type="button" onClick={() => removeItem(i)} className={removeBtnCls}>삭제</button>
        </div>
        <Field label="아이콘 (이모지)"><input className={inputCls} value={item.icon ?? ''} onChange={(e) => updateItem(i, { icon: e.target.value })} /></Field>
        <Field label="값"><input className={inputCls} value={item.value} onChange={(e) => updateItem(i, { value: e.target.value })} /></Field>
        <Field label="라벨"><input className={inputCls} value={item.label} onChange={(e) => updateItem(i, { label: e.target.value })} /></Field>
      </div>
    ))}
    <button type="button" onClick={addItem} className={addBtnCls}>+ 항목 추가</button>
    <label className="flex items-center gap-2 text-sm text-[var(--text)]">
      <input type="checkbox" checked={data.gradient} onChange={(e) => onChange({ ...data, gradient: e.target.checked })} className="accent-[var(--accent)]" />
      그라디언트 배경 사용
    </label>
  </>
}
```

import 추가:

```tsx
import type { StatsGridData, StatsBigData } from '@/lib/landing-variants/stats-schemas'
```

- [ ] **Step 4: 타입체크**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: 커밋**

```bash
git add src/components/landing-builder/LandingSectionSettingsSheet.tsx
git commit -m "feat(landing): SettingsSheet variant별 폼 분기 (hero 6 + cta 5 + stats 5)"
```

---

## 7. 서버 검증 & publish

### Task 28: PATCH/publish zod 검증

**Files:**
- Create: `src/lib/landing-variants/validate.ts`
- Modify: `src/app/api/admin/org/landing/route.ts`
- Modify: `src/app/api/admin/org/landing/publish/route.ts`

- [ ] **Step 1: 검증 헬퍼**

```ts
import type { LandingSection } from '@/types/landing'
import { findVariant } from './index'

export interface ValidationIssue {
  sectionId: string
  variant: string
  error: string
}

export function validateSections(sections: LandingSection[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  for (const s of sections) {
    const descriptor = findVariant(s.variant)
    if (!descriptor) {
      issues.push({ sectionId: s.id, variant: s.variant, error: 'unknown_variant' })
      continue
    }
    if (descriptor.type !== s.type) {
      issues.push({ sectionId: s.id, variant: s.variant, error: 'type_variant_mismatch' })
      continue
    }
    const parsed = descriptor.dataSchema.safeParse(s.data)
    if (!parsed.success) {
      issues.push({
        sectionId: s.id, variant: s.variant,
        error: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }
  }
  return issues
}
```

- [ ] **Step 2: PATCH에 검증 추가**

`src/app/api/admin/org/landing/route.ts` 의 PATCH에서 `normalizedSections` 계산 직후:

```ts
import { validateSections } from '@/lib/landing-variants/validate'

// ...
const normalizedSections = pageContent.sections.map((s, i) => ({ ...s, sortOrder: i }))

const issues = validateSections(normalizedSections)
if (issues.length > 0) {
  return NextResponse.json({ error: 'validation_failed', issues }, { status: 400 })
}
```

- [ ] **Step 3: publish 에도 검증 + revalidate**

`src/app/api/admin/org/landing/publish/route.ts` 수정 — sections 기반 경로에 validate 추가, 성공 후 `revalidatePath('/')`:

```ts
import { revalidatePath } from 'next/cache'
import { validateSections } from '@/lib/landing-variants/validate'

// body.sections 기반 경로 안에서 normalizedSections 계산 직후:
const issues = validateSections(normalizedSections)
if (issues.length > 0) {
  return NextResponse.json({ error: 'validation_failed', issues }, { status: 400 })
}

// update 완료 후:
revalidatePath('/')
return NextResponse.json({ ok: true, publishedAt: now })
```

기존 경로(body.sections 없이 page_content를 복사하는 fallback)도 fetch 후 sections를 `validateSections()` 한 뒤 복사. Phase A 이후 body 미포함 경로는 deprecate 표시.

- [ ] **Step 4: 타입체크 & 커밋**

```bash
npx tsc --noEmit
git add src/lib/landing-variants/validate.ts src/app/api/admin/org/landing/route.ts src/app/api/admin/org/landing/publish/route.ts
git commit -m "feat(landing): PATCH/publish에 variant zod 검증 + revalidatePath"
```

---

### Task 29: 공개 페이지 ISR + revalidate

**Files:**
- Modify: `src/app/(public)/page.tsx`

- [ ] **Step 1: revalidate export 추가**

파일 최상단에 export 추가:

```ts
export const revalidate = 60
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/(public)/page.tsx
git commit -m "feat(landing): 공개 페이지 ISR 60초 revalidate"
```

---

## 8. 테스트 & 썸네일 에셋

### Task 30: variant catalog 스모크 테스트

**Files:**
- Create: `src/lib/landing-variants/__tests__/catalog.test.ts`

- [ ] **Step 1: 테스트**

```ts
import { describe, it, expect } from 'vitest'
import '../index'                 // side-effect: register all
import { getVariants, findVariant } from '..'

const TYPES_WITH_VARIANTS_IN_PHASE_A = ['hero', 'cta', 'stats'] as const

describe('VARIANT_CATALOG Phase A', () => {
  it('hero/cta/stats 모두 1개 이상 variant 등록', () => {
    for (const t of TYPES_WITH_VARIANTS_IN_PHASE_A) {
      expect(getVariants(t).length).toBeGreaterThan(0)
    }
  })

  it('각 variant의 defaultData가 자체 schema를 통과한다', () => {
    for (const t of TYPES_WITH_VARIANTS_IN_PHASE_A) {
      for (const v of getVariants(t)) {
        const r = v.dataSchema.safeParse(v.defaultData())
        expect(r.success, `${v.id}: ${r.success ? '' : JSON.stringify(r.error.issues)}`).toBe(true)
      }
    }
  })

  it('findVariant로 id 역조회 가능', () => {
    expect(findVariant('hero-fullscreen-image')?.type).toBe('hero')
    expect(findVariant('cta-urgency')?.type).toBe('cta')
    expect(findVariant('nope-xxx')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실행**

```bash
npx vitest run src/lib/landing-variants/__tests__/catalog.test.ts
```

Expected: 3 passed

- [ ] **Step 3: 커밋**

```bash
git add src/lib/landing-variants/__tests__/catalog.test.ts
git commit -m "test(landing): variant catalog 스모크 테스트"
```

---

### Task 31: Variant thumbnail SVG 에셋

**Files:**
- Create: `public/landing-variants/hero-minimal.svg`, ... (16개)

- [ ] **Step 1: placeholder SVG 생성 스크립트**

```bash
mkdir -p /Users/gloryinside/NPO_S/public/landing-variants
```

각 variant id에 대해 간단한 placeholder SVG를 작성. 예시(`hero-minimal.svg`):

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#1a3a5c"/>
  <rect x="90" y="70" width="120" height="12" rx="2" fill="#fff" opacity="0.9"/>
  <rect x="110" y="92" width="80" height="8" rx="2" fill="#fff" opacity="0.6"/>
  <rect x="120" y="118" width="60" height="18" rx="4" fill="#fff"/>
</svg>
```

동일 패턴으로 나머지 15개(hero-split-image, hero-fullscreen-image, hero-fullscreen-video, hero-gallery, hero-stats-overlay, cta-banner, cta-gradient, cta-split, cta-urgency, cta-fullscreen, stats-grid, stats-inline, stats-cards, stats-countup, stats-big) 생성. 각 SVG는 해당 variant의 레이아웃을 단순 도형(rect)으로 표현.

**hero-split-image**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#f1f5f9"/>
  <rect x="20" y="50" width="110" height="10" rx="2" fill="#1a3a5c"/>
  <rect x="20" y="68" width="80" height="6" rx="2" fill="#64748b"/>
  <rect x="20" y="100" width="50" height="14" rx="3" fill="#1a3a5c"/>
  <rect x="160" y="30" width="120" height="140" rx="8" fill="#cbd5e1"/>
</svg>
```

**hero-fullscreen-image**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#334155"/>
  <rect width="300" height="200" fill="url(#g)" opacity="0.6"/>
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0.4"/><stop offset="1" stop-color="#000" stop-opacity="0.8"/></linearGradient></defs>
  <rect x="70" y="80" width="160" height="14" rx="2" fill="#fff"/>
  <rect x="100" y="104" width="100" height="8" rx="2" fill="#fff" opacity="0.8"/>
  <rect x="115" y="130" width="70" height="18" rx="4" fill="#fff"/>
</svg>
```

**hero-fullscreen-video**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#1e293b"/>
  <circle cx="150" cy="100" r="20" fill="#fff" opacity="0.3"/>
  <path d="M144 92 L144 108 L158 100 Z" fill="#fff"/>
  <rect x="70" y="140" width="160" height="10" rx="2" fill="#fff" opacity="0.9"/>
  <rect x="115" y="160" width="70" height="14" rx="4" fill="#fff"/>
</svg>
```

**hero-gallery**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#475569"/>
  <rect width="300" height="200" fill="#000" opacity="0.45"/>
  <rect x="70" y="70" width="160" height="14" rx="2" fill="#fff"/>
  <rect x="115" y="95" width="70" height="16" rx="4" fill="#fff"/>
  <g fill="#fff"><circle cx="140" cy="170" r="3"/><circle cx="150" cy="170" r="3" opacity="0.5"/><circle cx="160" cy="170" r="3" opacity="0.5"/></g>
</svg>
```

**hero-stats-overlay**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#334155"/>
  <rect width="300" height="200" fill="#000" opacity="0.5"/>
  <rect x="70" y="60" width="160" height="14" rx="2" fill="#fff"/>
  <rect x="100" y="84" width="100" height="8" rx="2" fill="#fff" opacity="0.8"/>
  <rect x="115" y="108" width="70" height="16" rx="4" fill="#fff"/>
  <rect x="0" y="160" width="300" height="40" fill="#000" opacity="0.6"/>
  <g fill="#fff"><rect x="20" y="172" width="30" height="8"/><rect x="90" y="172" width="30" height="8"/><rect x="160" y="172" width="30" height="8"/><rect x="230" y="172" width="30" height="8"/></g>
</svg>
```

**cta-banner**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#1a3a5c"/>
  <rect x="80" y="70" width="140" height="12" rx="2" fill="#fff"/>
  <rect x="110" y="92" width="80" height="6" rx="2" fill="#fff" opacity="0.7"/>
  <rect x="115" y="120" width="70" height="18" rx="8" fill="#fff"/>
</svg>
```

**cta-gradient**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1a3a5c"/><stop offset="1" stop-color="#2563eb"/></linearGradient></defs>
  <rect width="300" height="200" fill="url(#gg)"/>
  <rect x="70" y="65" width="160" height="16" rx="2" fill="#fff"/>
  <rect x="105" y="90" width="90" height="8" rx="2" fill="#fff" opacity="0.85"/>
  <rect x="110" y="125" width="80" height="22" rx="11" fill="#fff"/>
</svg>
```

**cta-split**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#1a3a5c"/>
  <rect x="20" y="80" width="120" height="10" rx="2" fill="#fff"/>
  <rect x="20" y="98" width="90" height="6" rx="2" fill="#fff" opacity="0.7"/>
  <rect x="180" y="80" width="80" height="22" rx="4" fill="#fff"/>
  <rect x="180" y="112" width="80" height="6" rx="2" fill="#fff" opacity="0.5"/>
</svg>
```

**cta-urgency**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#1a3a5c"/>
  <rect x="110" y="40" width="80" height="18" rx="9" fill="#ef4444"/>
  <text x="150" y="53" font-family="Arial" font-size="10" fill="#fff" text-anchor="middle" font-weight="bold">D-14</text>
  <rect x="80" y="70" width="140" height="10" rx="2" fill="#fff"/>
  <rect x="60" y="110" width="180" height="6" rx="3" fill="#fff" opacity="0.3"/>
  <rect x="60" y="110" width="120" height="6" rx="3" fill="#fff"/>
  <rect x="115" y="135" width="70" height="18" rx="4" fill="#fff"/>
</svg>
```

**cta-fullscreen**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#475569"/>
  <rect width="300" height="200" fill="#000" opacity="0.55"/>
  <rect x="60" y="70" width="180" height="16" rx="2" fill="#fff"/>
  <rect x="95" y="95" width="110" height="8" rx="2" fill="#fff" opacity="0.85"/>
  <rect x="100" y="130" width="100" height="22" rx="11" fill="#fff"/>
</svg>
```

**stats-grid**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#f1f5f9"/>
  <g fill="#1a3a5c"><circle cx="60" cy="70" r="10"/><circle cx="130" cy="70" r="10"/><circle cx="200" cy="70" r="10"/><circle cx="270" cy="70" r="10"/></g>
  <g fill="#1a3a5c"><rect x="42" y="90" width="36" height="12" rx="2"/><rect x="112" y="90" width="36" height="12" rx="2"/><rect x="182" y="90" width="36" height="12" rx="2"/><rect x="252" y="90" width="36" height="12" rx="2"/></g>
  <g fill="#64748b"><rect x="45" y="108" width="30" height="6" rx="2"/><rect x="115" y="108" width="30" height="6" rx="2"/><rect x="185" y="108" width="30" height="6" rx="2"/><rect x="255" y="108" width="30" height="6" rx="2"/></g>
</svg>
```

**stats-inline**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#f1f5f9"/>
  <rect x="0" y="85" width="300" height="30" fill="#fff"/>
  <g fill="#1a3a5c"><rect x="20" y="95" width="24" height="10" rx="2"/><rect x="80" y="95" width="24" height="10" rx="2"/><rect x="140" y="95" width="24" height="10" rx="2"/><rect x="200" y="95" width="24" height="10" rx="2"/></g>
  <g fill="#64748b"><rect x="48" y="97" width="28" height="6" rx="2"/><rect x="108" y="97" width="28" height="6" rx="2"/><rect x="168" y="97" width="28" height="6" rx="2"/><rect x="228" y="97" width="28" height="6" rx="2"/></g>
</svg>
```

**stats-cards**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#f8fafc"/>
  <g fill="#fff" stroke="#e2e8f0"><rect x="20"  y="50" width="60" height="100" rx="8"/><rect x="90"  y="50" width="60" height="100" rx="8"/><rect x="160" y="50" width="60" height="100" rx="8"/><rect x="230" y="50" width="60" height="100" rx="8"/></g>
  <g fill="#1a3a5c"><rect x="35" y="75" width="30" height="14" rx="2"/><rect x="105" y="75" width="30" height="14" rx="2"/><rect x="175" y="75" width="30" height="14" rx="2"/><rect x="245" y="75" width="30" height="14" rx="2"/></g>
</svg>
```

**stats-countup**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <rect width="300" height="200" fill="#f1f5f9"/>
  <g fill="#1a3a5c"><rect x="35" y="70" width="50" height="26" rx="2"/><rect x="110" y="70" width="50" height="26" rx="2"/><rect x="185" y="70" width="50" height="26" rx="2"/></g>
  <g fill="#64748b"><rect x="45" y="105" width="30" height="6" rx="2"/><rect x="120" y="105" width="30" height="6" rx="2"/><rect x="195" y="105" width="30" height="6" rx="2"/></g>
  <text x="150" y="155" font-family="Arial" font-size="8" fill="#64748b" text-anchor="middle">↑ count up</text>
</svg>
```

**stats-big**:
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200" width="300" height="200">
  <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#e2e8f0"/></linearGradient></defs>
  <rect width="300" height="200" fill="url(#bg)"/>
  <g fill="#1a3a5c"><rect x="30" y="60" width="60" height="50" rx="4"/><rect x="120" y="60" width="60" height="50" rx="4"/><rect x="210" y="60" width="60" height="50" rx="4"/></g>
  <g fill="#64748b"><rect x="40" y="125" width="40" height="8" rx="2"/><rect x="130" y="125" width="40" height="8" rx="2"/><rect x="220" y="125" width="40" height="8" rx="2"/></g>
</svg>
```

- [ ] **Step 2: 커밋**

```bash
git add public/landing-variants
git commit -m "feat(landing): Phase A variants 썸네일 SVG 16개"
```

---

### Task 32: 빌드 확인

- [ ] **Step 1: 타입체크 & 빌드**

```bash
npx tsc --noEmit
npm run build 2>&1 | tail -40
```

Expected: `tsc` 에러 없음, `next build` 성공.

- [ ] **Step 2: 전체 vitest 실행**

```bash
npx vitest run
```

Expected: landing-migrate 3 + catalog 3 = 6+ passed (기존 테스트 유지).

- [ ] **Step 3: 실수동 테스트 체크리스트**

공개/어드민 페이지에서 다음 시나리오 확인:
1. `/admin/landing` 진입 → 기존 섹션이 `{type}-default` variant로 보이는가
2. 섹션 추가 → variant 갤러리 모달이 뜨는가
3. 각 16개 variant 선택 → 섹션 생성 + 설정 시트 자동 오픈 + 해당 variant 전용 필드 표시
4. Variant 전환 → 경고 다이얼로그 → 공통 필드 보존 확인
5. 저장 → 공개 페이지(`/?draft=1`)에서 새 레이아웃 반영
6. 게시 → `/` 에서 반영 (revalidate 60초)

- [ ] **Step 4: 최종 커밋 (문서 업데이트)**

README 또는 `docs/` 에 Phase A 완료 메모 추가 후 커밋.

```bash
git add -A
git commit -m "chore(landing): Phase A 완료 — hero 6 + cta 5 + stats 5 (16 variants)"
```

---

## 9. Phase B~D 준비 (범위 외)

Phase A 완료 후 Phase B(testimonials 5 + logos 4 + faq 4), C(impact 5 + timeline 4 + gallery 5), D(campaigns 5 + tiers 5 + team 5 + richtext 3)는 동일 패턴으로 확장:

1. `src/types/landing.ts` 의 `LandingSectionType` 에 신규 타입 추가
2. `src/lib/landing-variants/{type}-schemas.ts`, `{type}-defaults.ts` 생성
3. `src/components/landing-builder/sections/{type}/*.tsx` 컴포넌트 구현
4. `src/lib/landing-variants/{type}.ts` 에 `registerVariants()` 추가
5. `src/lib/landing-variants/index.ts` 의 side-effect import 에 새 파일 추가
6. `variant-components.tsx` 에 매핑 추가
7. `SettingsSheet` 에 variant별 form 분기 추가
8. `public/landing-variants/` 썸네일 SVG 추가
9. `SECTION_CATALOG` 에 신규 타입 등록 (+ emoji/label/desc)

Phase D 는 기존 컴포넌트(`ImpactSection`/`CampaignsSection`/`DonationTiersSection`/`TeamSection`/`RichtextSection`)의 다른 variant를 추가하면서 default variant는 그대로 유지.
