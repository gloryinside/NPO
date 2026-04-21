# Landing Page Variant System — Design Spec

**Date**: 2026-04-21
**Scope**: 기관 랜딩페이지 섹션 빌더를 variant 기반 시각 강조 시스템으로 전환
**Phase 2 deferred**: financials 섹션 (재무 투명성)

---

## 1. Goals & Non-Goals

### Goals
- 기존 8개 섹션 + 신규 5개 섹션에 대해 총 **65개 variants** 제공
- 관리자가 variant 썸네일 갤러리에서 선택하는 3단계 에디터 UX
- **Visual-First** 원칙: 모션, 타이포 스케일, 그라디언트 토큰으로 첫 3초 임팩트
- 신뢰성(testimonials/logos/faq) + 스토리텔링(timeline/gallery) 신규 섹션
- 기존 발행 콘텐츠 무중단 마이그레이션 (schemaVersion 2, lazy 변환)

### Non-Goals
- Rich text WYSIWYG 에디터 (richtext variants는 HTML textarea 유지)
- 이미지 크롭 UI (외부 툴 사용 전제)
- A/B 테스팅 / 실험 플랫폼
- 다국어
- financials 섹션 (Phase 2 별도 spec)
- Lighthouse CI 등 성능 회귀 자동화

---

## 2. Architecture

### 2.1 Section schema v2

```ts
export interface LandingSection {
  id: string
  type: LandingSectionType
  variant: string             // NEW — 'hero-minimal' | 'hero-split-image' | ...
  sortOrder: number
  isVisible: boolean
  data: LandingSectionData    // variant별 union 스키마
}

export interface LandingPageContent {
  schemaVersion: 2            // bump from 1
  sections: LandingSection[]
}
```

### 2.2 LandingSectionType (13개)

**기존 8**: `hero`, `stats`, `impact`, `campaigns`, `donation-tiers`, `team`, `cta`, `richtext`
**신규 5**: `testimonials`, `logos`, `faq`, `timeline`, `gallery`

### 2.3 Variant Catalog (`src/lib/landing-variants.ts`)

```ts
interface VariantDescriptor {
  id: string                         // 'hero-fullscreen-video'
  type: LandingSectionType
  label: string                      // '풀스크린 비디오'
  description: string
  preview: string                    // /landing-variants/{id}.svg
  dataSchema: z.ZodSchema            // 런타임 검증
  defaultData: () => LandingSectionData
  visualWeight: 'minimal' | 'bold' | 'cinematic'
}

export const VARIANT_CATALOG: Record<LandingSectionType, VariantDescriptor[]> = {
  hero: [heroMinimal, heroSplitImage, heroFullscreenImage,
         heroFullscreenVideo, heroGallery, heroStatsOverlay],
  // ...
}
```

### 2.4 Shared fields (variant 전환 시 보존)

**규칙**: `SHARED_FIELDS[type]` 목록의 키는 해당 타입의 **모든 variants에 반드시 존재**. variant 전환 시 이 필드들의 값은 그대로 복사되고, 나머지 필드는 새 variant의 `defaultData()`로 교체된다. Variant 전용 필드(예: `campaigns-carousel.autoplayMs`)는 `SHARED_FIELDS`에 포함되지 않으며 전환 시 초기화된다.


```ts
export const SHARED_FIELDS: Record<LandingSectionType, string[]> = {
  hero:            ['headline', 'subheadline', 'ctaText', 'ctaUrl', 'textAlign'],
  stats:           ['title', 'items'],
  impact:          ['title', 'blocks'],
  campaigns:       ['title', 'subtitle', 'maxCount', 'showProgress'],
  'donation-tiers':['title', 'subtitle', 'tiers'],
  team:            ['title', 'members'],
  cta:             ['headline', 'body', 'buttonText', 'buttonUrl'],
  richtext:        ['title', 'content'],
  testimonials:    ['title', 'items'],
  logos:           ['title', 'logos'],
  faq:             ['title', 'items'],
  timeline:        ['title', 'events'],
  gallery:         ['title', 'images'],
}
```

---

## 3. Visual Design Principles

모든 variant 구현이 반드시 준수해야 하는 "비주얼 계약".

### 3.1 Motion by default
- `framer-motion` 도입 (복잡 애니메이션 전용, tree-shake: `motion.div`만 import)
- 경량 fade/slide는 CSS `@keyframes` + `IntersectionObserver` 수동 구현
- 공통 훅: Hero 텍스트 stagger fade-in, 배경 Ken Burns, Stats count-up, Impact/Testimonials/Gallery scroll fade-up, CTA hover elevate
- **`prefers-reduced-motion` 감지 시 전역 비활성** (`MotionWrapper`)

### 3.2 Hero impact
- 비주얼 강조 variants(`*-fullscreen-*`, `*-gallery`)는 `min-h-[80vh]` 기본
- 배경 이미지는 Ken Burns 6초 ease-in-out 루프
- hero-fullscreen-video: `autoplay muted playsinline loop`, mobile은 media query로 포스터 이미지만

### 3.3 Design tokens (`globals.css` 추가)

```css
:root {
  --gradient-1: linear-gradient(135deg, var(--accent),
                color-mix(in oklch, var(--accent), #000 30%));
  --gradient-soft: linear-gradient(180deg, var(--surface), var(--surface-2));
  --shadow-hero: 0 20px 60px -20px rgb(0 0 0 / 0.4);
  --shadow-card: 0 4px 20px -4px rgb(0 0 0 / 0.08);
  --radius-hero: 24px;
  --radius-card: 16px;
}
```

모든 variant는 이 토큰만 사용 (색상/그림자/라운드 하드코딩 금지).

### 3.4 Typography scale

```css
.text-display { font-size: clamp(2.5rem, 6vw, 5rem); font-weight: 800; }
.text-hero    { font-size: clamp(2rem, 4vw, 3.5rem); font-weight: 800; }
```

`cinematic` variant의 headline은 `.text-display`, `bold` variant는 `.text-hero`.

---

## 4. Variant Inventory (65개)

### 4.1 hero (6)
| id | weight | 특징 |
|---|---|---|
| hero-minimal | M | 단색 배경 + 중앙 텍스트. `hero-default` 마이그레이션 |
| hero-split-image | B | 좌 텍스트+CTA / 우 이미지, mobile stack |
| hero-fullscreen-image | C | 100vh 배경 이미지 + Ken Burns + 스크롤 인디케이터 |
| hero-fullscreen-video | C | 배경 autoplay muted loop, mobile 포스터 fallback |
| hero-gallery | C | 배경 이미지 3~5장 crossfade (6초), 중앙 텍스트 고정 |
| hero-stats-overlay | B | fullscreen-image + 하단 stats 3~4개 오버레이 |

### 4.2 stats (5)
stats-grid (M, default) / stats-inline (M) / stats-cards (B) / stats-countup (B) / stats-big (C)

### 4.3 impact (5)
impact-alternating (M, default) / impact-zigzag (B) / impact-cards (B) / impact-storytelling (C) / impact-before-after (C)

### 4.4 campaigns (5)
campaigns-grid (M, default) / campaigns-featured (B) / campaigns-carousel (B) / campaigns-list (M) / campaigns-masonry (C)

### 4.5 donation-tiers (5)
tiers-cards (M, default) / tiers-comparison (B) / tiers-recommended (B) / tiers-horizontal (M) / tiers-pricing-table (C)

### 4.6 team (5)
team-grid (M, default) / team-cards (B) / team-featured (B) / team-carousel (B) / team-org-chart (C)

### 4.7 cta (5)
cta-banner (M, default) / cta-gradient (B) / cta-split (B) / cta-urgency (C) / cta-fullscreen (C)

### 4.8 richtext (3)
richtext-plain (M, default) / richtext-boxed (M) / richtext-quote (B)

### 4.9 testimonials (5, 신규)
testimonials-cards (M) / testimonials-carousel (B) / testimonials-wall (B) / testimonials-quote-large (C) / testimonials-video (C)

### 4.10 logos (4, 신규)
logos-grid (M) / logos-marquee (B) / logos-press (B) / logos-partners (M)

### 4.11 faq (4, 신규)
faq-accordion (M) / faq-two-column (M) / faq-categorized (B) / faq-search (C)

### 4.12 timeline (4, 신규)
timeline-vertical (M) / timeline-alternating (B) / timeline-horizontal (B) / timeline-milestones (C)

### 4.13 gallery (5, 신규)
gallery-grid (M) / gallery-masonry (B) / gallery-lightbox (B) / gallery-carousel (B) / gallery-fullbleed (C)

### 4.14 Default variant per type

신규 5개 섹션은 최초 배포에서 첫 번째 variant가 default로 동작:
- testimonials-cards, logos-grid, faq-accordion, timeline-vertical, gallery-grid

---

## 5. Data Schema (zod)

### 5.1 hero family (전체 예시)

```ts
const HeroBase = z.object({
  headline: z.string().min(1).max(100),
  subheadline: z.string().max(300).optional(),
  ctaText: z.string().max(40).optional(),
  ctaUrl: z.string().max(500).optional(),
  textAlign: z.enum(['left', 'center', 'right']).default('center'),
})

const HeroMinimal = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#1a3a5c'),
})

const HeroSplitImage = HeroBase.extend({
  bgColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#ffffff'),
  rightImageUrl: z.string().url(),
  imageRatio: z.enum(['1:1', '4:3', '3:4']).default('1:1'),
})

const HeroFullscreenImage = HeroBase.extend({
  bgImageUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(40),  // 최소 30 강제 (접근성)
  kenBurns: z.boolean().default(true),
})

const HeroFullscreenVideo = HeroBase.extend({
  videoUrl: z.string().url(),
  posterUrl: z.string().url(),
  overlayOpacity: z.number().min(30).max(100).default(50),
  showMuteToggle: z.boolean().default(true),
})

const HeroGallery = HeroBase.extend({
  images: z.array(z.object({
    url: z.string().url(),
    alt: z.string().min(1).max(200),           // alt 필수 (접근성)
  })).min(2).max(8),
  intervalMs: z.number().min(3000).max(15000).default(6000),
  overlayOpacity: z.number().min(30).max(100).default(40),
})

const HeroStatsOverlay = HeroFullscreenImage.extend({
  stats: z.array(z.object({
    value: z.string().max(20),
    label: z.string().max(40),
  })).min(2).max(4),
})
```

### 5.2 나머지 섹션 스키마

각 variant의 zod 스키마는 `src/lib/landing-variants/{section}.ts`에 정의. 본 spec에서는 구조 규칙만 명시:

- **모든 이미지 URL 필드**는 `z.string().url()` + alt 필요 시 별도 필드
- **숫자 값**(overlayOpacity 등)은 min/max 명시
- **배열 필드**는 `.min(N).max(M)`으로 UX 경계 강제 (예: testimonials items min 1, max 20)
- **variant별 전용 필드**만 variant 스키마에 정의, 공통 필드는 Base에서 extend

### 5.3 Validation policy

- **PATCH 시점**: `/api/admin/org/landing` 의 PATCH에서 각 섹션의 `(type, variant, data)`를 zod 검증 → 실패 시 400 + 상세 오류
- **Publish 시점**: 동일 검증
- **Render 시점**: 검증 스킵 (이미 저장 시 검증됨, 성능 우선)
- **알 수 없는 variant id**: PATCH는 거절, Render는 `UnknownVariantFallback`으로 폴백

---

## 6. Editor UX (3-step flow)

### 6.1 Step 1 — Section type catalog
기존 `SECTION_CATALOG` 그리드 유지. 13개 타입 표시. 클릭 시 Step 2.

### 6.2 Step 2 — Variant gallery modal

레이아웃:
```
┌───────────────────────────────────────────┐
│ 히어로 섹션 · 6가지 variant                │
│ [전체] [미니멀] [강조] [시네마틱]          │  ← visualWeight 필터 칩
├───────────────────────────────────────────┤
│ ┌─────┐  ┌─────┐  ┌─────┐                 │
│ │ SVG │  │ SVG │  │ SVG │                 │
│ │미리보기│ │미리보기│ │미리보기│            │
│ └─────┘  └─────┘  └─────┘                 │
│ 미니멀    분할     풀스크린                │
│ [M]       [B]      [C]                     │
└───────────────────────────────────────────┘
```

- **썸네일**: `/public/landing-variants/{variantId}.svg` (120×80, 레이아웃을 단순 도형으로 표현)
- **visualWeight 배지**: `minimal` / `bold` / `cinematic` 색상 구분
- 클릭 시 variant로 섹션 생성 + Step 3 자동 진입

### 6.3 Step 3 — Settings sheet

기존 `LandingSectionSettingsSheet` 구조 유지. 변경사항:
- **상단에 "Variant 전환" 버튼** 추가 — 클릭 시 Step 2 재오픈
- Variant 전환 확인 다이얼로그:
  ```
  "Variant를 바꾸면 일부 입력이 초기화됩니다.
   유지: headline, subheadline, ctaText, ctaUrl, textAlign
   초기화: bgImageUrl, overlayOpacity, kenBurns
   계속하시겠습니까?"
  ```
- 폼 필드는 `VARIANT_CATALOG[type][variant].defaultData()` 기반 + variant별 전용 필드 동적 렌더

### 6.4 Live preview
- 에디터 우측 패널 (기존 미리보기) — `sections` state 변경 시 즉시 refresh (저장 debounce와 분리)
- variant 전환 즉시 새 레이아웃 반영

### 6.5 Asset 경고
`cinematic` variant 선택 시 필요 에셋 미입력 상태면 에디터 & 미리보기에 경고 배지:
- "이미지/비디오 에셋을 입력해야 완성된 비주얼 효과가 나타납니다"

---

## 7. Rendering & File Structure

```
src/components/landing-builder/
├── sections/
│   ├── hero/
│   │   ├── HeroMinimal.tsx
│   │   ├── HeroSplitImage.tsx
│   │   ├── HeroFullscreenImage.tsx
│   │   ├── HeroFullscreenVideo.tsx
│   │   ├── HeroGallery.tsx
│   │   ├── HeroStatsOverlay.tsx
│   │   └── index.ts                 # variant id → Component
│   ├── stats/  (5)
│   ├── impact/ (5)
│   ├── campaigns/ (5)
│   ├── donation-tiers/ (5)
│   ├── team/ (5)
│   ├── cta/ (5)
│   ├── richtext/ (3)
│   ├── testimonials/ (5)
│   ├── logos/ (4)
│   ├── faq/ (4)
│   ├── timeline/ (4)
│   ├── gallery/ (5)
│   └── index.ts                     # VARIANT_COMPONENTS registry
├── shared/
│   ├── MotionWrapper.tsx            # prefers-reduced-motion 가드
│   ├── CountUp.tsx                  # scroll-triggered counter
│   ├── KenBurns.tsx                 # 배경 이미지 자동 zoom/pan
│   ├── LightboxModal.tsx
│   └── VariantGalleryModal.tsx      # Step 2 모달
├── LandingRenderer.tsx               # (type, variant) dispatch
├── LandingSectionEditor.tsx          # 기존 (Step 3 수정)
└── LandingSectionSettingsSheet.tsx   # 기존 (Variant 전환 버튼 추가)
```

**Dispatch**:
```ts
const VARIANT_COMPONENTS = {
  'hero-minimal': HeroMinimal,
  'hero-split-image': HeroSplitImage,
  // ... 65개
} as const

function renderSection(section: LandingSection, campaigns: CampaignRow[]) {
  const Component = VARIANT_COMPONENTS[section.variant]
  if (!Component) return <UnknownVariantFallback section={section} />
  if (section.type === 'campaigns') {
    return <Component key={section.id} data={section.data} campaigns={campaigns} />
  }
  return <Component key={section.id} data={section.data} />
}
```

---

## 8. Performance

### 8.1 Server components default
- Variant **최상위 컴포넌트는 서버 컴포넌트**로 유지 (SEO, 초기 HTML payload 최소화)
- framer-motion이 필요한 요소만 별도 파일의 `'use client'` 하위 컴포넌트로 분리
  - 예: `HeroFullscreenImage.tsx` (server) → 내부에서 `KenBurnsClient.tsx` (client) import
  - `MotionWrapper`, `CountUp`, `KenBurns`, `LightboxModal`, carousel 로직 등이 client 파일
- `React.lazy` / `next/dynamic` 사용 안 함 (랜딩은 SEO + 첫 인상 우선, skeleton < 완성품)
- 이 규칙으로 framer-motion 번들은 해당 variant 사용 페이지에서만 로드되고, 서버 렌더 HTML이 유지됨

### 8.2 ISR on public landing
- `src/app/(public)/page.tsx`: `export const revalidate = 60`
- Publish 시 `revalidatePath('/')` 즉시 무효화

### 8.3 Image/video optimization
- 모든 이미지: `next/image`
- Hero 이미지: `priority`, `sizes="100vw"`
- Supabase storage: public URL CDN 프록시
- Video: `preload="metadata"`, `autoplay muted playsinline`, mobile은 media query로 포스터만

### 8.4 framer-motion 사용 범위
- **허용**: Ken Burns, parallax, gallery crossfade, stagger list
- **금지**: 전체 framer-motion import (`import * from 'framer-motion'`)
- **대신**: `import { motion } from 'framer-motion'` + `motion.div` 만 사용
- CSS 애니메이션으로 충분한 것(fade-in, slide-in)은 framer-motion 사용 금지

### 8.5 Core Web Vitals targets
- LCP < 2.5s
- CLS < 0.1 (이미지/비디오는 `aspect-ratio` 명시)
- INP < 200ms (인터랙션은 CSS 우선)

---

## 9. Accessibility

모든 variant 필수 준수:

- **`prefers-reduced-motion`**: `MotionWrapper`가 전역 감지 → 모든 애니메이션 비활성, fade도 즉시 표시
- **키보드 네비**: carousel/lightbox `←/→/ESC` 지원
- **Alt 필수**: 이미지 배열 필드(gallery, hero-gallery)는 스키마 레벨에서 `alt` required
- **색 대비**: `overlayOpacity.min(30)` 강제, text-on-image 4.5:1 이상
- **비디오**: hero-fullscreen-video는 `aria-hidden="true"` (배경 용도)
- **Semantic HTML**: `<section>`, `<h1>`(hero만), `<h2>`(그 외), `<figure>`
- **hero-gallery auto-advance**: reduced-motion 감지 시 정지 + 수동 인디케이터 표시

---

## 10. Testing Strategy

### 10.1 Schema tests (Jest/Vitest)
`src/lib/landing-variants/__tests__/catalog.test.ts`:
- 각 variant의 `defaultData()`가 자체 `dataSchema`를 통과
- variant 전환 시 `SHARED_FIELDS` 보존 로직 정확성
- 잘못된 data 입력 시 zod 거절

### 10.2 Render smoke tests (Vitest + RTL)
- 65개 variant × 1회 렌더 (defaultData)
- throw 없음 + 헤드라인/CTA 텍스트 DOM 존재 확인

### 10.3 E2E builder flow (Playwright — 기존 없으면 skip)
- Step 1 → 2 → 3 플로우
- variant 전환 시 공통 필드 보존 검증
- Save → publish → 공개 페이지 반영 검증

### 10.4 Accessibility automated
- `jest-axe` 로 각 variant 렌더 결과 a11y 검증 (모든 variant violations 0)

### 10.5 Out of scope
- Lighthouse CI (Phase A 이후 별도)
- 시각 회귀 (Percy/Chromatic)

---

## 11. Migration Strategy

### 11.1 schemaVersion 1 → 2

**DB 변경 없음**. `orgs.page_content` JSONB 내부 구조만 변경:
- `schemaVersion: 1` → `schemaVersion: 2`
- 각 section에 `variant: string` 필드 추가

### 11.2 Lazy migration

```ts
// 읽을 때 (GET /api/admin/org/landing, 공개 페이지)
function migrateToV2(content: LandingPageContent): LandingPageContent {
  if (content.schemaVersion === 2) return content
  return {
    schemaVersion: 2,
    sections: content.sections.map(s => ({
      ...s,
      variant: (s as LandingSection).variant ?? `${s.type}-default`,
    })),
  }
}
```

**Default variant 매핑** (기존 레이아웃 보존):
| type | default variant |
|---|---|
| hero | hero-minimal |
| stats | stats-grid |
| impact | impact-alternating |
| campaigns | campaigns-grid |
| donation-tiers | tiers-cards |
| team | team-grid |
| cta | cta-banner |
| richtext | richtext-plain |

### 11.3 Persistent migration
- 에디터에서 **어떤 섹션이라도 수정 시** PATCH → 전체 page_content가 v2로 영구 저장
- published_content도 publish 시 v2로 저장

### 11.4 Rollback safety
- v2는 v1 superset (variant 필드 추가만)
- 롤백 시 v1 리더는 `variant` 필드 무시, 기존 레이아웃으로 렌더
- **무결한 역호환**

### 11.5 Phased release

| Phase | Variants | 설명 |
|---|---|---|
| **A (필수)** | hero 6 + cta 5 + stats 5 = 16 | 인프라 + 최우선 비주얼 충격. 이 단계 완료 시 production 배포 가능 |
| **B** | testimonials 5 + logos 4 + faq 4 = 13 | 신뢰/사회적 증명 |
| **C** | impact 5 + timeline 4 + gallery 5 = 14 | 스토리텔링 |
| **D** | campaigns 5 + tiers 5 + team 5 + richtext 3 = 18 | 기존 섹션 variant 풍부화 |
| **Phase 2** | financials | 별도 spec |

**Phase A 이후 B~D는 점진 배포**. 각 Phase에서 신규 variant 컴포넌트만 추가하면 자동으로 VARIANT_COMPONENTS 레지스트리에 등록됨.

---

## 12. Dependencies

- `framer-motion` ^11.x (~40KB gzip, tree-shake)
- `zod` (이미 사용 중이면 재사용, 없으면 추가)

---

## 13. API Changes

### 13.1 `PATCH /api/admin/org/landing`
- 요청 body의 `pageContent.sections[].variant` 검증 추가
- 각 section의 `data`를 variant-specific zod 스키마로 검증
- 실패 시 400 + `{ error: 'validation_failed', details: zodIssues }`

### 13.2 `POST /api/admin/org/landing/publish`
- 동일 검증 로직
- `revalidatePath('/')` 호출 추가

### 13.3 새 API 없음
- 기존 엔드포인트 확장만

---

## 14. Open Questions (해결 완료)

- [x] visualWeight 태그 의미 확정 (minimal/bold/cinematic)
- [x] SHARED_FIELDS 정의 확정
- [x] framer-motion 도입 확정
- [x] schemaVersion bump + lazy migration 확정
- [x] Phase A 범위 확정 (hero 6 + cta 5 + stats 5)

---

## 15. Success Criteria

- Phase A 배포 후 기존 발행 페이지 모두 무변화로 렌더 (default variant 마이그레이션)
- 새 variant 65개 모두 렌더 스모크 테스트 통과
- Lighthouse mobile 점수: LCP < 2.5s, CLS < 0.1 (hero variants 대상)
- jest-axe 모든 variant 0 violations
- 관리자가 Step 1→2→3 플로우로 variant 전환 및 저장 가능
- Phase A 완료 시점에 production 배포 가능 (B~D는 점진)
