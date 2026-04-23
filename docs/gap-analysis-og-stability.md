# GAP 분석 — Phase 7-F OG 안정성 (2026-04-23)

OG 엔드포인트 2종(`invite-og`, `impact-og`)이 Satori 렌더 실패 또는 DB
조회 예외 시 500을 내고 카톡/페북 미리보기가 "빈 상태"로 뜨는 상황을 방어.
G-123을 구현, G-122는 "의도적 미구현"으로 결정.

---

## 구현 개요

### 신규 lib: `src/lib/og/fallback.ts`

- `buildFallbackOgSvg(opts)` — 1200×630 SVG 문자열 생성 (Satori 의존 없음)
  - 두 color gradient + headline(대형) + 선택적 subhead
  - XML escape 내장 (`< > & " '`) — 기관명에 주입 문자 있어도 안전
  - 구조: `<?xml ... <svg> <defs><linearGradient> <rect> <text>*3 </svg>`
- `fallbackOgResponse(opts)` — 짧은 공용 캐시(`public, max-age=3600`) 200 OK
  - 렌더가 정상화되면 1시간 내 전환되도록 캐시 단축

### 두 route에 try/catch 적용

**`/api/public/invite-og`**:
- GET 전체를 try로 감싸고 catch에서 `fallbackOgResponse({ headline: '함께 후원해요', subhead: '후원 프로그램에 초대합니다' })`
- 기존 정상 경로는 본래대로(ImageResponse + public CDN 캐시 24h 유지)

**`/api/donor/impact/og`**:
- 인증 실패(401) 분기는 try 밖 — 크롤러가 아니라 본인 전용 경로
- 세션 통과 이후의 DB/렌더만 try로 감쌈 (impact 집계 / orgs 조회 / ImageResponse)
- catch → `fallbackOgResponse({ headline: '나의 후원 임팩트', subhead: '함께한 후원의 기록' })`

### 테스트

**신규**: `tests/unit/og/fallback.test.ts` — 9/9 통과
- 기본 옵션 / headline·subhead 커스텀 / subhead 생략 시 `<text>` 블록 제거
- gradient 색상 치환
- XML 특수문자 이스케이프 (`<script>alert("xss")</script>` → `&lt;script&gt;...&quot;`)
- prolog/namespace 포함 여부
- Content-Type: image/svg+xml / Cache-Control: public max-age=3600

---

## G-122 — 의도적 미구현 결정

원 GAP: "크롤러 별 OG 캐시 우회 가능성 — 카톡은 자동 cache-buster 없음, 페북은 공유 디버거로 수동 refresh 가능."

**결정: 구현하지 않음.**

이유:
1. **플랫폼 제약**: 카톡/페북 캐시 주기는 외부 시스템이고 우리 앱이 제어 불가능
2. **기존 도구로 대체 가능**: 페북 공유 디버거(`https://developers.facebook.com/tools/debug/?q={url}`)가 이미 공개 도구로 존재. admin이 URL 하나 넣으면 해결
3. **빈도 매우 낮음**: 기관명/초대자 이름은 코드 생명주기 중 거의 변경 없음
4. **G-118의 `public, max-age=3600, s-maxage=86400` 자체 캐시는 적절한 값**. 더 짧게 가면 CDN 효과 저하

필요해지면(예: 기관 리브랜딩 상황) 다시 검토. 그때는 "admin 대시보드에 페북 디버거 딥링크" + "카톡 캐시는 사용자에게 1회 재공유 안내" 정도면 충분.

---

## 남은 리스크 (2건)

### 낮음

#### G-128. fallback SVG의 이모지 렌더 불일치
- SVG `<text>`에서 이모지(`💌`, `✨`)는 브라우저/OS마다 다르게 그림 — 카톡 미리보기에선 기본 OS 이모지로 대체됨
- 정상 경로(Satori + NotoSansKR)는 통일된 렌더지만 fallback은 시스템 의존
- **해결**: fallback에선 이모지 제거 또는 SVG `<path>`로 아이콘 직접 그림
- **우선순위**: 낮음 (실제 렌더 실패 빈도 자체가 매우 낮음)

#### G-129. fallback 캐시가 정상 렌더로 전환 시 stale 남음
- 렌더 실패 → fallback SVG 1시간 캐시 → 원인 해소 후에도 CDN이 1시간 동안 fallback 제공
- 대부분의 렌더 실패는 일시적(타임아웃/OOM)이라 사용자가 감지 못 할 수준
- **해결**: 실패 시에만 `no-store`로 전환 (현재는 1시간 캐시)
- **우선순위**: 낮음 (장애 상황 자체가 드묾)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **353 passed** (+9 fallback; storage 2건 환경 실패 무관) |
| 신규 lib | 1 (`og/fallback.ts`) |
| 수정 route | 2 (`invite-og`, `impact-og`) |
| 마이그레이션 | 0 |
| 빌드 | 타입체크 통과 |

---

## GAP 상태 (코드 grep 기준)

**Phase 7-F에서 처리**: G-123 (닫힘), G-122 (의도적 미구현)

**누적 닫힘 (Phase 5 ~ 7-F)**:
G-102, G-107, G-110, G-113, G-114, G-115, G-116, G-117, G-118, G-119, G-120, G-121, G-123 (13건)

**남은 open 낮음**:
G-101 초대 중복 재가입, G-124 admin/receipts 의미 분리, G-125 cheer (created_at,id) tie-break, G-126 cheer 총 카운트 라이브, G-128/G-129 fallback 후속
