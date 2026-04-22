# GAP 분석 — Phase 6-C 공유 성장 (2026-04-22)

Phase 5-B(초대)와 5-A(임팩트 공유 카드)가 작동하는 상태에서 **수신자 맥락**을
강화하고 **OG 이미지 생성 안정성·성능**을 함께 끌어올리는 단계.
세 축: **G-103(초대 카피에 기관명) + G-98(OG 캐시) + G-100(OG 한글 폰트)**.

---

## 구현 개요

### 1. G-103 — 초대 카피에 기관명 + 개인화 메시지

**변경**: `src/app/(donor)/donor/invite/page.tsx`
- `getTenant()` 호출해 `tenant.name`을 `orgName`으로 추출 (fallback "기관")
- 헤더 문구에 기관명 강조: `{orgName}의 후원에 지인을 초대하고…`
- `ReferralCodeCard`에 `orgName`, `inviterName` prop 주입

**변경**: `src/components/donor/invite/ReferralCodeCard.tsx`
- 공유 메시지 템플릿 생성:
  ```
  {마스킹이름}님이 {기관명} 후원에 초대했어요. 아래 링크로 함께해 주세요.
  {inviteUrl}
  ```
  - 초대자 이름은 `maskName`(첫 글자 + ○ 1~3)으로 처리 — cheer lib와 같은 규칙 재구현
  - 이름이 비면 `"기관명 후원에 함께해 주세요"`로 축약
- 플랫폼별 공유 필드 분리:
  - `navigator.share({ title, text, url })` — 카톡/문자/노트 앱이 각자 방식으로 조합
  - 실패/미지원 시 `{text}\n{url}` 한 덩어리를 클립보드에 복사 (fallback)
- 버튼 3개 병렬: "코드 복사 / 초대 링크 복사 / 메시지 복사 / 공유하기"
- **공유 메시지 프리뷰 박스** 추가 — 공유자가 실제로 보낼 문구를 카드에서 직접 볼 수 있음

### 2. G-98 — OG 이미지 Cache-Control

**변경**: `src/app/api/donor/impact/og/route.tsx`
- `ImageResponse`를 변수로 받고 `Cache-Control: private, max-age=300, stale-while-revalidate=60` 추가
- **private** 선택 이유: 이 카드는 본인 세션에서만 401 해제되는 개인화 자산 — 공용 CDN에 넣으면 안 됨. 브라우저/엣지 개인 캐시만 사용
- 같은 세션 내 프리뷰 반복 + 소셜 크롤러 여러 번 hit 시 DB 쿼리/렌더 비용 실측 기준 5분 캐시로 충분

### 3. G-100 — OG 한글 폰트

**변경**: `src/app/api/donor/impact/og/route.tsx`
- `readFile`로 `public/fonts/NotoSansKR-Regular.ttf`, `NotoSansKR-Bold.ttf` 로드
- **모듈 단위 메모** (`cachedFonts`) — 모듈 life-cycle 동안 1회만 디스크 I/O. 이후는 메모리 상수 사용
- `ImageResponse`의 `fonts` 옵션으로 weight 400/700 등록, `fontFamily`는 `'NotoSansKR, sans-serif'`
- **폰트 로드 실패 시 graceful fallback**: `loadKoreanFonts`는 catch 후 null 반환 → 옵션 생략, 일부 글자가 박스로 나올 수 있지만 503 내지 않음
- Buffer → ArrayBuffer 변환은 `.buffer.slice(byteOffset, byteOffset+byteLength)`로 정확히 이 버퍼 영역만 추출 (Node Buffer 공유 문제 방지)

---

## 남은 리스크 (3건)

### 중간

#### G-118. 초대 메시지 카카오톡 링크 미리보기(meta OG) 부재
- 현재 `{origin}/donor/signup?ref=코드` URL은 donor signup 페이지로, 별도 meta 태그 없어 공유 시 미리보기 이미지/설명이 빈약
- **해결**: `/donor/signup` 페이지에 `generateMetadata`로 `openGraph: { title, description, images: ['/api/public/invite-og?ref=...'] }` 추가 + 공용 invite OG 엔드포인트 신설 (기관 로고 + 초대 문구)
- **우선순위**: 중간 (카톡/페북 공유 빈도 증가 시 전환율 직결)

### 낮음

#### G-119. OG 개인 카드의 공유 엔트리 부재
- `/api/donor/impact/og`는 `/donor/impact` 페이지 "공유 카드" 버튼에서 프리뷰만 됨 — 실제 SNS 공유 시 크롤러가 직접 fetch할 대상 URL이 없음 (401)
- **해결**: 로그인된 본인에게만 뜨는 "이 카드를 이미지로 저장" 버튼 — fetch → blob → download. 사용자가 자기 앱으로 올려 공유
- **우선순위**: 낮음 (현재 수동 스크린샷으로 대체 가능)

#### G-120. OG 캐시 무효화 없음
- `private, max-age=300` — 후원자가 금액 변경·신규 결제를 해도 최대 5분 동안 이전 카드가 보임
- **해결**: 결제/promise 변경 시 `?v={last_change_ts}` 쿼리를 카드 URL에 붙여 natural invalidation
- **우선순위**: 낮음 (5분 stale 수용 가능)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **183 passed** (신규 없음 — UI/헤더/폰트 변경 위주) |
| 변경 파일 | 3 (`invite/page.tsx`, `ReferralCodeCard.tsx`, `impact/og/route.tsx`) |
| 신규 API | 0 |
| 마이그레이션 | 0 |
| 빌드 | 성공 |

---

## Phase 6 완료 선언

- ✅ **Phase 6-A 운영 인사이트**: G-105 / G-108 / G-109
- ✅ **Phase 6-B 감사 플로우 + 본인 관리**: G-112 / G-106 / G-111
- ✅ **Phase 6-C 공유 성장 (이번)**: G-103 / G-98 / G-100

### 누적 해소 GAP (Phase 5 + 6 통합)

Phase 5에서 누적된 GAP 5개 중 4개 해소(G-98, G-100, G-103, G-106)와
Phase 5-D의 G-108/G-109/G-112까지 합쳐 **총 7개 해소 + 새로 식별한 후속 3개(G-118~G-120)**.

### 다음 후보

- **Phase 7-A — 운영 자동화**: G-107(약정 변경 rate limit) / G-115(이메일 opt-out) / G-117(감사 이메일 debounce) — 사용자 마찰 측면
- **Phase 7-B — 공유 깊이**: G-118(카톡 미리보기) / G-119(이미지 저장 버튼) — 공유 전환율 측면
- **Phase 7-C — 데이터 의무**: G-101(초대 보상 악용 방지) / G-102(referral_codes RLS) / G-116(ISR 즉시 무효화) — 컴플라이언스/신뢰 측면
