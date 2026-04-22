# GAP 분석 — Phase 7-B 초대 URL 소셜 미리보기 (2026-04-23)

Phase 6-C에서 초대 카피/OG 캐시/한글 폰트를 정리한 뒤,
초대 URL 자체가 카톡/페이스북에 공유될 때 **수신자 미리보기 품질**을 높이는 단계.
세 축 중 **G-118(초대 URL OG 미리보기)** 을 먼저 닫는다.

---

## 구현 개요

### 1. 공용 폰트 유틸 추출

**신규 lib**: `src/lib/og/fonts.ts`
- `loadKoreanFonts()` — 모듈 단위 메모 캐시, 로드 실패 시 null graceful fallback
- 기존 `impact/og/route.tsx` 내부 복제본을 제거하고 import로 전환 (DRY)

### 2. 공용 invite OG 엔드포인트

**신규 API**: `GET /api/public/invite-og?ref=<code>`
- 무인증 공용 — 카톡/페북 크롤러가 직접 fetch
- `loadInviteOgContext` 순수 함수 (테스트 가능):
  - `ref` 없거나 유효하지 않으면 `{ orgName: '후원 기관', inviterName: null }` fallback
  - `findReferrerByCode` → `orgs.name` + `members.name` 병렬 조회
- 이미지 구성:
  - `{마스킹이름}님이 초대했어요` 큰 타이틀 + `{기관명} 후원 프로그램` 서브헤드
  - 초대자 이름 없으면 `함께 후원해요` 범용 문구
  - 1200×630 (OG 표준), linear-gradient 배경 (#1e3a8a → #7c3aed)
- 캐시: `public, max-age=3600, s-maxage=86400, stale-while-revalidate=3600`
  - 기관명/초대자는 코드 생명주기 동안 불변 → CDN 공용 캐시 안전

### 3. signup 페이지 generateMetadata

**변경**: `src/app/(donor)/donor/signup/page.tsx`
- Next.js 16 패턴: `searchParams: Promise<{ ref?: string }>` → await
- `ref` 존재 시만 `openGraph.images`/`twitter.images`를 `/api/public/invite-og?ref=...`로 지정
- 절대 URL 조립: `headers()`의 `x-forwarded-proto` + `x-forwarded-host` 사용 (멀티테넌트 호환)
  - `host` 헤더 없으면 기본 메타만 (fallback, 200 OK)
- `twitter.card = 'summary_large_image'` — 카드 타입 명시

### 4. 테스트

**신규**: `tests/unit/og/invite-og-context.test.ts` — 6/6 통과
- ref null / 빈 문자열 → fallback
- 존재하지 않는 ref → fallback
- 유효한 ref → orgName + inviterName 반환
- orgs 누락 시 fallback org + inviterName 유지
- members 누락 시 inviterName null

---

## 남은 리스크 (3건)

### 중간

#### G-121. invite-og의 ref 파라미터 길이/형식 검증 없음
- 현재 `ref`에 임의 긴 문자열을 넣어도 `findReferrerByCode`가 내부 `trim().toLowerCase()` 후 SQL 쿼리를 태움
- Supabase가 길이 제한을 걸지만, 수천자 ref로 스팸성 OG 요청이 오면 DB/CDN 비용 증가
- **해결**: route 레벨에서 `ref.length > 32`이면 즉시 fallback (DB 조회 skip)
- **우선순위**: 중간 (공격 관측 시)

### 낮음

#### G-122. 크롤러 별 OG 캐시 우회 가능성
- 카톡은 `?refresh=1` 같은 cache-buster를 자동으로 붙이지 않음 → 초대자 이름 변경 시 최대 24시간 stale
- 페북은 "공유 디버거"에서 수동 refresh 가능
- **해결**: 초대 코드 변경이 없으면 문제 없음. 정말 필요하면 `?v={code}` 자연 무효화
- **우선순위**: 낮음 (이름 변경 빈도 매우 낮음)

#### G-123. OG 이미지 렌더 실패 시 fallback 정적 이미지 부재
- Satori 렌더 자체가 실패하면 500 → 카톡이 미리보기 없이 링크만 표시 (UX 저하는 있지만 기능 장애 아님)
- **해결**: `try/catch`로 감싸 `public/og/invite-default.png` 리다이렉트
- **우선순위**: 낮음 (폰트 로드 실패는 이미 graceful, Satori 자체 실패는 드묾)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **279 passed** (+6 invite-og-context; storage 2건 환경 실패 무관) |
| 신규 lib | 1 (`og/fonts.ts` — `impact/og`와 공유) |
| 신규 API | 1 (`/api/public/invite-og`) |
| 수정 API | 1 (`/api/donor/impact/og` — 폰트 유틸 공유) |
| 수정 페이지 | 1 (`/donor/signup` — generateMetadata) |
| 마이그레이션 | 0 |
| 빌드 | 타입체크 통과 |

---

## Phase 7-B 진행 상황

- ✅ **G-118 초대 URL OG 미리보기 (이번)**
- ⏳ G-119 OG 이미지 다운로드 버튼 — 수동 공유용
- ⏳ G-120 OG 캐시 자연 무효화 (`?v=last_change_ts`)

### 누적 해소 GAP

- Phase 7-A (`e002036`): G-107 / G-115 / G-117
- Phase 7-C (`13f62cb`): G-102 / G-116
- Phase 7-B (이번): G-118

### 다음 후보

- **Phase 7-D — 데이터 의무**: G-101 초대 중복 가입 방지 (보상 기능 도입 전 검토), G-113 IPv6 /64 마스킹 (공격 관측 시)
- **Phase 7-E — UX 마감**: G-110 cheer 페이지네이션, G-114 변경이력 CSV 내보내기, G-119/G-120 OG 후속
