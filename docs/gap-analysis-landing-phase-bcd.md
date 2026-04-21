# GAP 분석 — 랜딩 Variant 시스템 Phase B~D (2026-04-21)

Phase B (13) + C (14) + D (18) = 45개 신규 variants 구현 완료. 총 **61개 variants** 가동 중.
Phase B~D 구현 과정과 완료 후 발견된 GAP을 정리.

---

## 구현 집계

| Phase | 섹션 | Variants | 파일 수 |
|---|---|---|---|
| A | hero 6 + cta 5 + stats 5 | 16 | ~22 |
| B | testimonials 5 + logos 4 + faq 4 | 13 | ~20 |
| C | impact 5 + timeline 4 + gallery 5 | 14 | ~20 |
| D | campaigns 5 + tiers 5 + team 5 + richtext 3 | 18 | ~22 |
| **총** | **13 섹션** | **61** | **~84** |

- schemaVersion 2 lazy migration은 13 섹션 모두 호환
- 테스트: 11/11 passed (migrate 4 + catalog 7)
- 썸네일 SVG 61개 모두 존재
- `npm run build` 성공

---

## 높음 (3건)

### G-59. variant 전용 필드 편집 UI 커버리지 불완전

**파일**: `src/components/landing-builder/LandingSectionSettingsSheet.tsx`, `src/components/landing-builder/variant-forms/*`
**문제**: Phase D의 일부 variant 전용 필드가 에디터 UI에 노출되지 않아 편집 불가:
- `team-org-chart.parent` — 스키마에는 있지만 `TeamForm` 에서 입력 UI 없음. 관리자가 JSON을 직접 편집하지 않는 한 조직도 계층을 구성할 수 없다.
- `tiers-pricing-table.benefits`/`tiers-recommended.benefits` — `TiersRecommendedForm(showBenefits)`에는 노출되지만 `DonationTiersForm`(기본)은 benefits 편집 없음. `tiers-comparison`은 DonationTiersForm을 쓰는데 비교표가 benefits 배열에 의존 → 편집 UI 부재로 공백 상태로 표시됨.
- `campaigns-*.maxCount` 상한이 variant마다 다름 (grid 3, featured 4, carousel 6, masonry 6) — `CampaignsForm`은 고정 옵션(2/3/4/6)만 제공.

**해결**:
- `TeamOrgChartForm` 신규 — `parent` 드롭다운(기존 멤버 name 중 선택)
- `TiersComparisonForm` 신규 — benefits 배열 편집
- `CampaignsForm`에 variant별 maxCount 범위 반영

**우선순위**: 높음 (실사용 차단)

---

### G-60. Legacy `CampaignsForm`/`DonationTiersForm`/`TeamForm`/`ImpactForm`/`RichtextForm` 혼재

**파일**: `src/components/landing-builder/LandingSectionSettingsSheet.tsx:140-190`
**문제**: Phase D는 neue variants만 추가하고 기존 form들을 그대로 사용한다. 공통 필드는 커버되지만 **variant 전용 필드**(cta-split.secondaryLabel, hero-stats-overlay.stats 같은 Phase A 패턴)가 이들 섹션에서는 분리되지 않은 상태:
- `RichtextForm` (plain/boxed용) + `RichtextQuoteForm` (quote용) — 이미 분기됨 ✓
- `TiersRecommendedForm` (recommended/pricing-table용) + `DonationTiersForm` (나머지) — 분기됨 ✓
- `ImpactForm` 은 `impact-alternating` legacy fallback으로만 사용 — 이미 Phase C에서 각 variant 전용 form 분기됨 ✓
- `CampaignsForm`/`TeamForm` 은 모든 variant 공통 사용 — 전용 필드 없지만 기존 form이 variant별 maxCount 제약을 반영하지 않음(G-59)

**해결**: G-59에 포함.

**우선순위**: 높음 (분기 일관성)

---

### G-61. schemaVersion 2 데이터에 legacy v1 레이아웃이 섞임

**파일**: `src/components/landing-builder/LandingRenderer.tsx`, `variant-components.tsx`
**문제**: Phase D에서 `ImpactSection`, `DonationTiersSection`, `TeamSection`, `RichtextSection`의 기존 컴포넌트는 VARIANT_COMPONENTS에서 **제거되었지만** 기존에 발행된 페이지의 `{type}-default` variant는 신규 컴포넌트로 매핑된다:
- `impact-alternating` → ImpactAlternating (Phase C) ✓
- `tiers-cards` → TiersCards (Phase D) ✓
- `team-grid` → TeamGrid (Phase D) ✓
- `richtext-plain` → RichtextPlain (Phase D) ✓

교체 후 렌더가 같은 모양을 유지하는지는 **수동 확인 필요**. 특히 `RichtextSection`은 기존에 `sanitizeHtml`로 DOMPurify 호출, 신규 `RichtextPlain`도 동일 sanitize 사용 — 호환됨. `TeamSection`은 기존에 `photoUrl` 없으면 `name[0]` fallback, `TeamGrid`도 동일 — 호환됨.

**리스크**: 이미지 URL 포맷, 스타일 세부(border radius 등)가 디자인 토큰 상수로 변경되면서 기존 발행 페이지에서 이미지 둥글기·그림자가 미묘하게 달라질 수 있음. 스테이징에서 기존 샘플 페이지를 직접 대조 필요.

**해결**:
- 스테이징 환경에서 v1 page_content 샘플을 투입하고 /? 렌더 결과 비교
- 차이가 큰 경우 legacy fallback 컴포넌트를 VARIANT_COMPONENTS에 `legacy-*-default` 별칭으로 유지, migration 매핑 변경

**우선순위**: 높음 (발행 페이지 회귀 가능)

---

## 중간 (5건)

### G-62. campaigns variants의 `maxCount` 상한이 스키마에 없음

**파일**: `src/lib/landing-variants/campaigns-schemas.ts`
**문제**: 각 variant 레이아웃이 전제하는 `maxCount` 최적값이 있지만 스키마는 공통 `max(12)`만 제한. `campaigns-grid`를 12로 설정하면 레이아웃이 깨질 수 있음.

**해결**: variant별 스키마 분리 또는 `superRefine`으로 variant-aware 제약.

**우선순위**: 중간 (관리자 실수 방지)

---

### G-63. testimonials-video의 videoUrl 처리 유연성 부족

**파일**: `src/components/landing-builder/sections/testimonials/TestimonialsVideo.tsx:51`
**문제**: `videoUrl.replace('watch?v=', 'embed/')`로 YouTube만 지원. Vimeo, 자체 호스팅 mp4 미지원. 관리자가 YouTube 외 플랫폼 URL 입력 시 iframe이 빈 화면.

**해결**: URL 파싱으로 YouTube/Vimeo/mp4 자동 감지 후 적절한 플레이어 선택. `plyr.js` 같은 경량 라이브러리 도입도 고려.

**우선순위**: 중간 (사용 유연성)

---

### G-64. gallery-lightbox의 이미지 원본 크기 의존

**파일**: `src/components/landing-builder/sections/gallery/GalleryLightbox.tsx:61`
**문제**: lightbox 모드에서 `max-h-[80vh]` + `object-contain`으로 원본 이미지를 그대로 로드. 고해상도 이미지(5MB+)를 그리드 썸네일에도 동일 URL로 사용 → 초기 로드 시 불필요한 대용량 전송.

**해결**:
- `next/image`로 교체해 그리드는 작은 사이즈, lightbox 열 때 full size 별도 요청
- 또는 Supabase storage image transformation 쿼리 파라미터 활용 (`?width=400` vs `?width=1920`)

**우선순위**: 중간 (성능)

---

### G-65. faq-search의 검색어 하이라이트 부재

**파일**: `src/components/landing-builder/sections/faq/FaqSearch.tsx`
**문제**: 검색어로 필터링은 되지만 매칭 텍스트가 하이라이트되지 않음. 긴 FAQ에서 왜 해당 항목이 매치됐는지 파악 어려움.

**해결**: 매치된 부분을 `<mark>` 태그로 감싸 하이라이트. XSS 방지를 위해 escape 후 `<mark>` 삽입.

**우선순위**: 중간 (UX 품질)

---

### G-66. timeline-horizontal 가로 스크롤 인디케이터 부재

**파일**: `src/components/landing-builder/sections/timeline/TimelineHorizontal.tsx`
**문제**: 가로 스크롤 구역인데 좌우 스크롤 가능함이 시각적으로 드러나지 않음. 모바일에서 터치 스와이프 힌트가 없어 사용자가 전체 이벤트를 못 보고 지나칠 수 있음.

**해결**:
- 우측에 그라디언트 페이드 오버레이 ("..." 느낌)
- `scroll-snap-type: x mandatory` + 좌우 화살표 버튼 (gallery-carousel처럼)

**우선순위**: 중간 (UX 명확성)

---

## 낮음 (6건)

### G-67. team-org-chart가 flex 기반 — 깊이 3+ 이상에서 레이아웃 붕괴

**파일**: `src/components/landing-builder/sections/team/TeamOrgChart.tsx`
**문제**: 현재 `NodeView`는 children을 단순 `flex gap-6`로 배치. 깊이 3 이상 (손자 노드)이면 공간 계산이 안 됨.

**해결**: 깊이가 깊은 조직도라면 `react-d3-tree` 같은 라이브러리 도입. 현재 NPO 규모에서는 2단계(대표 → 팀원)가 일반적이라 보류.

**우선순위**: 낮음 (기관 규모에 따라)

---

### G-68. impact-before-after 모바일 터치 이벤트 부자연스러움

**파일**: `src/components/landing-builder/sections/impact/ImpactBeforeAfter.tsx`
**문제**: `onPointerDown` / `onPointerMove` / `onPointerUp`을 사용하지만 터치 디바이스에서 scroll과 드래그 구분이 모호. 슬라이더를 드래그하려 하면 페이지 스크롤이 같이 발생.

**해결**: `touch-action: pan-y` 또는 드래그 시작 시 `preventDefault`.

**우선순위**: 낮음 (모바일 UX)

---

### G-69. testimonials-wall masonry가 CSS columns 기반

**파일**: `src/components/landing-builder/sections/testimonials/TestimonialsWall.tsx`
**문제**: `columns-3`는 세로 방향 채움 순서가 아니라 컬럼 순서로 정렬됨 (1→2→3→4→5→6 이 아니라 1→4 / 2→5 / 3→6). 후기 순서가 중요할 경우 의도와 다를 수 있음.

**해결**:
- 관리자가 순서에 민감하면 JS 기반 masonry(`react-masonry-css`) 또는 CSS grid `grid-auto-flow: dense` 검토
- 현재는 후기 순서가 크게 중요하지 않아 보류

**우선순위**: 낮음 (순서 중요도에 따라)

---

### G-70. logos-marquee 무한 스크롤 키보드/reduced-motion 처리

**파일**: `src/components/landing-builder/sections/logos/LogosMarquee.tsx`, `src/app/globals.css:176-180`
**문제**: `animate-marquee`는 globals.css에서 `prefers-reduced-motion` 시 비활성화되지만, 비활성화 상태에서는 로고들이 왼쪽 끝에만 몰림 (초기 translateX=0 상태). 사용자가 로고를 볼 수 없음.

**해결**: reduced-motion 감지 시 flex-wrap grid로 레이아웃 변경 (LogosGrid와 동일).

**우선순위**: 낮음 (접근성 개선)

---

### G-71. tiers-pricing-table의 CTA 버튼이 전부 `#campaigns`

**파일**: `src/components/landing-builder/sections/donation-tiers/TiersPricingTable.tsx:54`
**문제**: 모든 등급의 "후원하기" 버튼이 동일하게 `#campaigns`로 연결. 등급별로 다른 URL (예: 정기후원 플로우로 특정 tier.amount 프리필)이 불가능.

**해결**: 각 `Tier` 스키마에 optional `url` 필드 추가. 없으면 `#campaigns` fallback.

**우선순위**: 낮음 (전환 최적화 여지)

---

### G-72. Variant 갤러리 모달에서 visualWeight 필터 안 쓸 때 UI

**파일**: `src/components/landing-builder/VariantGalleryModal.tsx`
**문제**: variant 수가 많은 섹션(hero 6, 다른 건 4~5)에서 필터를 안 쓰면 스크롤 길어짐. "cinematic만 보기" 같은 추천 기본값 없이 전체부터 보여주면 비전문가 관리자가 압도당할 수 있음.

**해결**: 첫 방문 시 자동으로 `bold` 필터 선택 + "더 많은 옵션 보기" 링크로 전체 노출. 또는 popular 기반 추천(MVP 후 데이터 누적 필요).

**우선순위**: 낮음 (온보딩 UX)

---

## 즉시 조치 가능 (다음 PR)

| # | 항목 | 난이도 |
|---|---|---|
| G-59 | TeamOrgChartForm + TiersComparisonForm + CampaignsForm maxCount | 낮음 |
| G-65 | faq-search 하이라이트 | 낮음 |
| G-66 | timeline-horizontal 스크롤 인디케이터 | 낮음 |
| G-71 | tier별 CTA URL 필드 | 매우 낮음 |

### 다음 세션

- G-61 (legacy 렌더 회귀) — 스테이징 샘플 페이지 직접 대조
- G-63 (테스티모니얼 영상 Vimeo/mp4 지원) — URL 파서 도입
- G-64 (gallery-lightbox 성능) — next/image + Supabase 이미지 변환

### Phase 2 / 보강 스프린트

- G-62 (variant별 maxCount superRefine) — 스키마 정교화
- G-67 (team-org-chart 계층 레이아웃 라이브러리) — 규모 따라
- G-68 (before-after 터치 UX) — PlayTests 필요
- G-69 (testimonials-wall 순서) — 관리자 피드백 기반
- G-70 (marquee reduced-motion fallback) — 접근성 스프린트
- G-72 (Variant 갤러리 추천 UX) — 사용 데이터 기반 최적화

### 이전 미해결 GAP (Phase A 분석 문서에서 이관)

- G-48 (Playwright 썸네일 자동 생성) — 수동 SVG 품질이 아직 낮음, 실제 렌더 스크린샷 치환 필요
- G-49 (framer-motion 번들 최적화) — 61개 variants 전부 가동 후 측정
- G-50 (iframe live preview) — 에디터 UX 스프린트
- G-51 (cinematic asset 경고 배지) — 미구현
- G-52 (variant 전환 confirm 커스텀 UI) — 네이티브 confirm 사용 중

---

## 프로덕션 배포 체크리스트

1. **스테이징 검증** (G-61 관련)
   - [ ] 기존 발행된 `orgs.published_content` 샘플로 `/` 페이지 로드
   - [ ] impact/tiers/team/richtext 섹션이 v1과 시각적으로 동일한지 비교
   - [ ] 차이가 크면 legacy 컴포넌트를 VARIANT_COMPONENTS에 유지하고 migration 매핑 조정

2. **에디터 동작 검증**
   - [ ] 13 섹션 각 default variant 생성 → 저장 → 공개 반영
   - [ ] variant 전환 플로우 (공통 필드 보존)
   - [ ] cinematic variant 에셋 업로드
   - [ ] `tiers-pricing-table` 편집 시 benefits 입력 동작

3. **성능**
   - [ ] Lighthouse mobile 측정 (LCP, CLS, INP)
   - [ ] 번들 분석 (`next build` 로그에서 First Load JS 증가량)
   - [ ] hero-fullscreen-video 모바일 poster fallback (G-54 Phase A 이관)

4. **접근성**
   - [ ] 13 섹션에 대해 `@axe-core/react` 검사
   - [ ] 키보드 전용 네비게이션 (lightbox/carousel)
   - [ ] `prefers-reduced-motion` 전환 동작 (특히 logos-marquee — G-70)
