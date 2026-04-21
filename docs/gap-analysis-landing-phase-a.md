# GAP 분석 — 랜딩 Variant 시스템 Phase A (2026-04-21)

Phase A 구현 완료 후 발굴된 GAP. Phase B~D 계획과 즉시 조치 가능한 항목으로 분류.

---

## 높음 (3건)

### G-47. variant legacy 혼재 — `{type}-default`가 없는 type들

**파일**: `src/components/landing-builder/variant-components.tsx`, `src/lib/landing-migrate.ts`
**문제**: 현재 VARIANT_COMPONENTS에는 Phase A의 16개 + legacy 5개(`impact-alternating`, `campaigns-grid`, `tiers-cards`, `team-grid`, `richtext-plain`)만 등록되어 있다. 기존 섹션의 migration은 이 legacy variant id로 매핑되지만, **legacy 5개 섹션은 zod 검증에서 skip**된다(`validate.ts`의 `legacyDefaults` 화이트리스트). Phase B~D 진행 시 이들도 variant 시스템에 편입되면서 zod 스키마 검증 대상이 되어야 하는데, 기존 데이터가 신규 스키마를 만족하지 않아 저장이 실패할 가능성.
**해결**:
- Phase B 시작 시 각 legacy variant의 zod 스키마 정의 + 기존 `getDefaultSectionData()` 값과 호환되는지 migration 테스트 추가
- 불일치가 발견되면 추가 migration 레이어 (`migrateV2toV2_1`) 도입
**우선순위**: 높음 (Phase B 차단 가능성)

---

### G-48. variant 썸네일 SVG 품질 — 단순 도형만 있음

**파일**: `public/landing-variants/*.svg` (16개)
**문제**: Phase A 썸네일은 rect/circle 기반 단순 와이어프레임. "시각적 임팩트" 원칙에 비해 관리자가 실제 렌더 결과와 연결짓기 어렵다. 특히 hero-fullscreen-video, hero-gallery 같은 시네마틱 variants는 정적 도형으로는 정수를 전달하지 못함.
**해결**:
- **단기**: 각 variant에 실제 변형 요소(그라디언트, 드롭 섀도우, 실제 목업 이미지)를 넣어 SVG 품질 상향
- **근본**: Playwright로 각 variant의 default 렌더 결과를 실제 스크린샷(1200×800 → 300×200 다운스케일)으로 자동 생성. `npm run screenshot:variants` 스크립트로 CI에서 생성.
**우선순위**: 높음 (관리자 UX 핵심 경험)

---

### G-49. `framer-motion` 번들 영향 — 서버 컴포넌트 경계 미최적화

**파일**: `src/components/landing-builder/shared/MotionWrapper.tsx`, `CountUp.tsx`, `KenBurns.tsx` / 각 variant 컴포넌트
**문제**: 현재 `MotionFadeUp`을 hero/cta/stats 거의 모든 variant가 사용한다. `HeroMinimal`은 서버 컴포넌트여야 하지만 `MotionFadeUp` import로 인해 client boundary가 부모로 "lifting" 되어 서버 렌더 이점이 약화될 수 있다.
**측정 미완료**: 실제 번들 크기(초기 JS payload) 측정 필요. Next.js 빌드 로그상 `First Load JS` 증가량.
**해결**:
- `MotionFadeUp`을 CSS-only fade-up 대체제(ex. `@keyframes` + IntersectionObserver manual)로 **기본 fade-in**은 처리하고, framer-motion은 stagger/spring 필요한 곳에만 사용
- `variant-components.tsx` 레지스트리 매핑 시점에 `React.lazy` 대신 **각 variant 파일의 최상위 import를 서버/클라이언트로 명확히 분리** (부모 server, 하위 motion 파일만 client)
**우선순위**: 높음 (성능 공약 준수)

---

## 중간 (5건)

### G-50. 에디터 live preview — 미리보기가 즉시 반영되지 않음

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx:254-263` (미리보기 `<a target="_blank">` 링크)
**문제**: 현재 미리보기는 별도 탭에서 `/?draft=1`을 여는 방식. 에디터에서 variant 전환/필드 수정 직후 미리보기 반영은 **새로고침 수동**. Spec §6.4 "Live preview" 미충족.
**해결**:
- 에디터 우측에 iframe 영역 추가 + `postMessage`로 sections state 전달해 즉시 리렌더
- 또는 Supabase Realtime 구독으로 `page_content` 변경을 미리보기 탭이 감지 (2초 debounce save 이후)
**우선순위**: 중간 (UX 품질)

---

### G-51. Asset 경고 — cinematic variant 에셋 미입력 시 경고 배지 부재

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx`
**문제**: Spec §6.5 "cinematic variant 선택 시 필요 에셋 미입력 상태면 경고 배지 표시" 미구현. 현재는 빈 bgImageUrl/videoUrl 상태에서도 아무 경고 없이 저장되고, 미리보기에서만 깨진 이미지가 뜬다.
**해결**:
- `SortableRow`에 variant의 `visualWeight === 'cinematic'` + 핵심 에셋 필드가 빈 경우 ⚠️ 배지 표시
- Settings sheet의 해당 필드 위에도 인라인 경고
**우선순위**: 중간 (발행 사고 예방)

---

### G-52. variant 전환 confirm() 다이얼로그 — 커스텀 UI 필요

**파일**: `src/components/landing-builder/LandingSectionEditor.tsx:handleVariantChange`
**문제**: 현재 `confirm(...)` 네이티브 다이얼로그 사용. 기존 에디터 디자인(dark surface, accent 강조)과 불일치. 유지/초기화 필드 목록도 줄바꿈 `\n`으로 평문 전달되어 가독성 낮음.
**해결**: `@base-ui/react` Dialog 컴포넌트로 교체 (이미 `@base-ui/react` 설치되어 있음). 유지/초기화 필드를 리스트로 시각화 + Hero-split-image → Hero-minimal처럼 전환 방향 표시.
**우선순위**: 중간 (일관된 디자인 시스템)

---

### G-53. framer-motion dynamic import — Ken Burns/CountUp 초기 JS 지연 로드 미적용

**파일**: `src/components/landing-builder/shared/*.tsx`
**문제**: `MotionFadeUp`은 Above-the-fold에서 즉시 필요하지만, `CountUp`/`KenBurns`는 스크롤 진입 후에만 의미있다. 현재는 모두 variant 컴포넌트 상단에서 import되어 초기 번들에 포함.
**해결**: `CountUp`/`KenBurns` 는 `React.lazy` + `<Suspense>` 또는 `next/dynamic({ ssr: true })`으로 지연. Ken Burns는 서버 렌더에 포함되어야 SEO/LCP 유지 가능하므로 구체 전략 필요.
**우선순위**: 중간 (성능 점진 개선)

---

### G-54. hero-fullscreen-video mobile fallback — media query 기반 poster 로드 미구현

**파일**: `src/components/landing-builder/sections/hero/HeroFullscreenVideo.tsx`
**문제**: Spec §8.3 "mobile은 media query로 포스터 이미지만 로드". 현재 구현은 데스크톱/모바일 모두 동일하게 `<video autoplay muted loop>`을 로드한다 — 모바일 3G 환경에서 LCP 저하.
**해결**:
- `<picture>` 패턴으로 mobile에서는 `<img src={posterUrl}>` 만 렌더하고 데스크톱에서만 `<video>` 로드
- 또는 CSS `@media (max-width: 768px) { video { display: none } }` + `<img>` 를 모바일용으로 병렬 렌더 (`lazy` loading)
**우선순위**: 중간 (모바일 성능)

---

## 낮음 (4건)

### G-55. variant별 폼 — hero 6 + cta 5 + stats 1(big)만 구현, 나머지 stats 4개는 기존 StatsForm 재사용

**파일**: `src/components/landing-builder/LandingSectionSettingsSheet.tsx:134-139`
**문제**: stats-grid/inline/cards/countup는 data 스키마가 동일(StatsBase)이라 문제 없지만, **추후 variant별 고유 옵션**(예: stats-countup의 `durationMs` prop, stats-cards의 `hoverLift` toggle)이 추가되면 분기 누락 가능.
**해결**: 현재는 OK. 각 variant에 고유 옵션이 생길 때 해당 form만 분기 추가.
**우선순위**: 낮음 (예방적)

---

### G-56. GET `/api/admin/org/landing` 응답 캐시 헤더 부재

**파일**: `src/app/api/admin/org/landing/route.ts:44`
**문제**: 어드민이 에디터 로드 시마다 매번 Supabase 조회. 어드민 세션 내 `orgs.page_content`가 변하지 않는 빈도가 높은데 HTTP 캐시 활용 안 함.
**해결**: `Cache-Control: private, max-age=30` 정도. 단, PATCH 직후 GET이면 stale 이슈 있어 Admin 토큰 기반 ETag 편이 안전.
**우선순위**: 낮음 (미세 최적화)

---

### G-57. Phase B~D 준비 — register-all에 placeholder import 미포함

**파일**: `src/lib/landing-variants/register-all.ts`
**문제**: 현재 `hero`, `cta`, `stats`만 import. Phase B(testimonials/logos/faq) 파일 생성 후 `register-all.ts`에 추가하는 것을 잊으면 catalog에 노출되지 않음.
**해결**: Phase B 시작 시 체크리스트에 명시. 또는 `fs.readdir` 기반 dynamic import를 Build time에 수행(codegen).
**우선순위**: 낮음 (운영 절차)

---

### G-58. 기존 8개 SECTION_CATALOG에 신규 5 섹션(testimonials/logos/faq/timeline/gallery) 미포함

**파일**: `src/types/landing.ts:133` (SECTION_CATALOG)
**문제**: Phase A에서 `LandingSectionType` 유니온에 신규 5 type을 추가하지 않았다. Phase B~C 시작 시 타입 + SECTION_CATALOG + `DEFAULT_VARIANT_SUFFIX` + `SHARED_FIELDS` + `landing-migrate.DEFAULT_VARIANT` 5곳 모두 동기 추가 필요.
**해결**: Phase B 시작 시 한 커밋으로 5곳 일괄 업데이트. TS가 `DEFAULT_VARIANT_SUFFIX`/`SHARED_FIELDS`의 `Record<LandingSectionType, ...>` 타입 검사로 누락을 compile-time에 잡아줄 것이라 안전.
**우선순위**: 낮음 (타입 시스템이 강제)

---

## 즉시 조치 가능 (이번 세션)

| # | 항목 | 난이도 |
|---|---|---|
| G-54 | mobile video fallback | 낮음 |
| G-51 | cinematic asset 경고 배지 | 낮음 |
| G-58 | Phase B 타입 추가 체크리스트 문서화 | 매우 낮음 |

### 다음 세션 (Phase B 시작 전)

- G-47 (legacy zod 스키마 정의) + G-58 (5 섹션 타입 추가) 를 묶어서 Phase B 첫 커밋으로
- G-48 (Playwright 썸네일 자동 생성) — 독립 커밋, Phase B 중 병행

### Phase 2

- G-49 (framer-motion 번들 최적화) — 전체 65 variants 구현 후 측정 기반 최적화
- G-50 (iframe live preview) — 에디터 전반 개선 스프린트
- G-53 (CountUp/KenBurns dynamic import) — 성능 스프린트

---

## Phase B~D 우선순위 재확인

현재 상태로 **Phase A 단독 배포 가능**하며 아래 우선순위로 이어감을 권장:

1. **Phase B — 신뢰/사회적 증명** (testimonials 5 + logos 4 + faq 4 = 13 variants)
   - NPO 도메인에서 전환율 직결 섹션, Phase A 비주얼 임팩트와 시너지
   - G-47, G-58 선행 필수

2. **Phase C — 스토리텔링** (impact 5 + timeline 4 + gallery 5 = 14 variants)
   - Phase B 완료 후 감정/스토리 레이어 추가
   - gallery는 고난도(lightbox, fullbleed scroll) — framer-motion 활용도 높음

3. **Phase D — 기존 섹션 variant 풍부화** (campaigns 5 + tiers 5 + team 5 + richtext 3 = 18)
   - Phase A~C가 "새 것 추가"라면 D는 "기존 것 강화"
   - 기존 legacy variant 유지하며 variant 추가만으로 충분

4. **Phase 2** — financials 섹션 (별도 spec 필요, 캠페인 재무 데이터 연결)
