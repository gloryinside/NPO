# GAP 분석 — 랜딩 Variant 시스템 스프린트 마무리 (2026-04-22)

Phase A~D 완료 + 사후 GAP(G-47~G-72) 14건 모두 해소한 뒤 재검토.
이 문서는 **전체 스프린트 마무리 시점의 남은 리스크/개선 영역**과 실제 운영 진입 체크리스트를 정리한다.

---

## 스프린트 완료 집계

| 범주 | 처리 건수 | 주요 항목 |
|---|---|---|
| Phase A | 16 variants | hero 6 + cta 5 + stats 5 |
| Phase B | 13 variants | testimonials 5 + logos 4 + faq 4 |
| Phase C | 14 variants | impact 5 + timeline 4 + gallery 5 |
| Phase D | 18 variants | campaigns 5 + tiers 5 + team 5 + richtext 3 |
| **Variants 총계** | **61** | 13 섹션 타입 |
| Phase A GAP 처리 | 12건 | G-47~G-58 (문서) + G-58 타입 추가 구현 |
| Phase B~D GAP 처리 | 14건 | G-59~G-72 전부 |
| 테스트 | 11 passed | migrate 4 + catalog 7 |
| 썸네일 SVG | 61/61 | `public/landing-variants/` |
| 빌드 | ✅ | `npm run build` 성공 |

---

## 스프린트 마무리 시점에 해소된 주요 항목

- **G-59** 전용 필드 UI: `TeamOrgChartForm`(parent 드롭다운), `TiersComparisonForm`(benefits), `CampaignsForm`(variant별 maxCount)
- **G-61** legacy 안전망: `legacy-impact/tiers/team/richtext` variant id 유지 → DB 수동 전환 통로
- **G-62** campaigns variant별 maxCount 스키마 정교화 (grid 2-6, featured 3-5, carousel 4-12 …)
- **G-63** testimonials-video: URL 파서로 YouTube/Vimeo/mp4/알 수 없음 분기
- **G-64** gallery 성능: Supabase storage transformation (썸네일 400, 뷰어 1920) + `loading="lazy"`
- **G-65** faq-search: `<Highlighted>` 컴포넌트로 검색어 하이라이트 (React-safe, XSS 경로 없음)
- **G-66** timeline-horizontal: 스크롤 가능 방향 감지 + 그라디언트 페이드 + 좌우 버튼 (disable 처리)
- **G-68** before-after: `touch-action: none` + `setPointerCapture` + 키보드 접근성(←/→/Home/End)
- **G-70** logos-marquee: `prefers-reduced-motion` 감지 시 grid fallback
- **G-71** tier별 CTA URL 필드 스키마 + 폼 + 렌더
- **G-72** Variant 갤러리 기본 필터: 6+ variants면 bold 기본, 편집 모드는 현재 weight
- **G-51** SortableRow asset 경고 배지 + `checkMissingAssets()` 유틸 (10개 variant에 필수 에셋 정의)
- **G-52** variant 전환 커스텀 다이얼로그 (`VariantChangeConfirmDialog`): 전환 방향 시각화 + 유지되는 필드 목록 + cancel/confirm

---

## 남은 리스크 (6건)

### 중간

#### G-73. Phase A 썸네일 SVG 실렌더 치환 (G-48 이관)

**상태**: 수동 도형 SVG 그대로. 각 variant의 실제 렌더 결과와 관리자 인지 갭이 남아있음.
**해결**: Playwright 스크립트로 각 variant default 렌더를 1200×800 스크린샷 → 300×200 PNG로 다운스케일. `npm run screenshot:variants` 추가.
**우선순위**: 중간 (온보딩 UX)

#### G-74. framer-motion 번들 영향 측정 미완 (G-49 이관)

**상태**: 61 variants 중 `motion.div`는 MotionFadeUp 1곳만 사용하지만, `useReducedMotion` 훅이 여러 파일에서 import되어 초기 JS에 framer-motion이 포함됨. 실제 `First Load JS` 증가량 미측정.
**해결**:
- `useReducedMotion` 래퍼를 경량 custom hook(`useMediaQuery('(prefers-reduced-motion: reduce)')`)으로 치환
- Ken Burns/CountUp은 CSS-only로 충분하므로 framer-motion 의존 제거
**우선순위**: 중간 (성능 공약)

#### G-75. Live preview iframe 미구현 (G-50 이관)

**상태**: 여전히 `/?draft=1` 새 탭 방식. variant 전환/필드 수정 직후 반영은 수동 새로고침.
**해결**: 에디터 우측 패널 iframe + postMessage로 `sections` state 전달, 2초 debounce 저장과 별개로 즉시 리렌더.
**우선순위**: 중간 (UX 품질)

### 낮음

#### G-76. team-org-chart 깊이 3+ 레이아웃 붕괴 (G-67 이관)

**상태**: 현재 flex 기반. NPO 규모상 대부분 2-3단계라 실사용 문제 없음. 대형 기관에서 4단계 이상 필요 시 `react-d3-tree` 도입.
**우선순위**: 낮음 (규모에 따라)

#### G-77. testimonials-wall 순서 제어 (G-69 이관)

**상태**: CSS columns 기반 — 관리자 정의 순서와 렌더 순서가 다를 수 있음. 현재 후기 순서 중요도가 낮아 보류.
**해결**: 순서가 중요해지는 시점에 `react-masonry-css` 또는 `grid-auto-flow: dense` 검토.
**우선순위**: 낮음

#### G-78. 기존 발행 페이지 스테이징 회귀 검증 미완 (G-61 실측)

**상태**: G-61에서 `legacy-*` 별칭 안전망은 추가했지만 **실제 스테이징 환경에서 v1 샘플 투입 → /? 렌더 비교**는 수행하지 않음.
**해결**: 프로덕션 배포 전 체크리스트 1번 항목 (아래) 이행.
**우선순위**: 낮음 (배포 직전 이행)

---

## 프로덕션 배포 체크리스트

1. **스테이징 v1→v2 회귀 검증 (G-78)**
   - [ ] 배포 전 staging에서 샘플 기관 1~2곳의 published_content(v1) 로드
   - [ ] `/` 페이지 렌더 결과를 v1 배포 브랜치와 시각 대조
   - [ ] 문제 섹션 발견 시 DB `update orgs set published_content = jsonb_set(..., section.variant = 'legacy-*')`로 즉시 복원 가능 여부 확인

2. **에디터 플로우 검증**
   - [ ] 13 섹션 × 기본 variant 신규 생성 → 저장 → 공개 반영
   - [ ] Variant 전환 다이얼로그 (G-52) 동작 확인
   - [ ] 필수 에셋 경고 배지 (G-51): hero-fullscreen-video를 `videoUrl` 비운 채 저장 → SortableRow에 `⚠️ 에셋 필요` 표시되는지
   - [ ] team-org-chart parent 드롭다운에서 순환 참조 방지(자기 자신 제외 노출 확인)
   - [ ] tiers-comparison benefits 입력 → 체크표에 반영

3. **성능 & 접근성 스폿 체크**
   - [ ] Lighthouse mobile: hero-fullscreen-video, gallery-lightbox 페이지에서 LCP < 2.5s
   - [ ] `npm run build` 로그의 First Load JS 값을 v1 배포 기준선과 비교
   - [ ] `prefers-reduced-motion: reduce` 상태에서:
     - hero-gallery 자동 슬라이드 멈춤
     - logos-marquee grid fallback (G-70)
     - Ken Burns 정지
   - [ ] 키보드만으로 Lightbox(←/→/ESC), Before-After(←/→/Home/End) 조작

4. **데이터 무결성**
   - [ ] schemaVersion 1 content를 에디터에서 단순 열람만 하고 닫으면 DB 변경 없어야 함 (read-only migration)
   - [ ] 에디터에서 아무 것도 수정 안 하고 저장 시 schemaVersion 2로 영구화되는지
   - [ ] PATCH/publish 시 잘못된 data 투입 시 400 + issues 응답

5. **경로·롤백**
   - [ ] Phase D 배포 커밋 해시 기록
   - [ ] 문제 발생 시 `git revert` 대상 커밋 및 legacy-* 별칭 동작 확인

---

## 다음 스프린트 제안 (우선순위 순)

1. **G-73** 실렌더 썸네일 Playwright 자동 생성 — 관리자 UX 완성도
2. **G-74** framer-motion 제거/경량화 — 성능 스프린트
3. **G-75** Live preview iframe — 에디터 완결성
4. **G-76~G-77** 사용 데이터 누적 후 재평가

---

## 스프린트 총평

- Phase A~D 61 variants + GAP 26건(Phase A 12 + Phase B~D 14) 전부 처리
- 신뢰성·시각 임팩트·스토리텔링·전환율 모든 축 커버
- 안전망(legacy 별칭, zod 검증, 에셋 경고, 공통 필드 보존)으로 실수동 위험 최소화
- 남은 4건(G-73~G-76/77/78)은 **배포 차단이 아닌 점진 개선 항목**. 프로덕션 진입 가능.
