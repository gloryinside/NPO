# GAP 분석 — Phase 5-D 후원자 응원 메시지 벽 (2026-04-22)

Phase 5-C 업/다운그레이드 이어, Phase 5-D에서 **캠페인 공개 페이지의 응원 메시지 벽**을 추가했다.
실제 후원 자격이 확인된 member만 쓸 수 있고, 공개 시 이름은 마스킹(김○○)되며,
관리자는 검수 페이지에서 부적절한 메시지를 숨길 수 있다.

---

## 구현 개요

### 1. 데이터 인프라

**신규 마이그레이션**: `20260422000005_cheer_messages.sql`
- 테이블: `cheer_messages(id, org_id, campaign_id, member_id, body, anonymous, published, hidden, hidden_reason, created_at)`
- CHECK `char_length(body) BETWEEN 1 AND 500` — DB 레벨 일차 방어
- **부분 인덱스 2종 + full 인덱스 1종**으로 "뜨거운 경로/운영 경로" 분리
  - `idx_cheer_campaign_created WHERE published=true AND hidden=false` — 공개 조회(대부분)
  - `idx_cheer_general_created WHERE campaign_id IS NULL AND published=true AND hidden=false`
  - `idx_cheer_org_all` — admin 검수 리스트
  - `idx_cheer_member_campaign` — rate limit 조회 보조
- `campaign_id ON DELETE SET NULL`: 캠페인이 삭제돼도 응원 기록은 "일반 응원"으로 살아남음

### 2. 공용 lib (`src/lib/cheer/messages.ts`) — 10/10 테스트 통과

- `maskName(raw)` — 이모지 안전한 Array.from 기반 마스킹 (첫 글자 + ○ 1~3개)
- `createCheerMessage({...})` — 세 단계 검증:
  1. 길이 1~500자
  2. 최근 1시간 3건 초과 여부 (member+campaign 기준)
  3. INSERT 실패 시 `insert_failed`
- `listPublicCheerMessages` — anonymous=true면 서버에서 displayName 마스킹, 원본 이름은 클라이언트로 나가지 않음
- `setCheerHidden` — admin 호출 대상 (호출부에서 org 검증 책임)

**쿼리 순서 주의**: `.limit()`는 `.is()/.eq()` 필터 **뒤에** 와야 테스트 더블과 호환되고 의미도 명확하다 (초기 작성 시 limit이 앞에 있어 테스트 실패 → 수정).

### 3. API

**공개/후원자 API**: `src/app/api/cheer/route.ts`
- `GET /api/cheer?campaignId=<uuid>&limit=50` — tenant 기준 공개 조회, 무인증
- `POST /api/cheer` — donor 세션 필수
  - rate limit: `cheer:post:${memberId}` 분당 3회 (lib의 시간당 3회 제한과 조합)
  - campaignId 제공 시 `campaigns.org_id = session.member.org_id` 검증 (cross-tenant 차단)
  - lib 에러 → HTTP 코드 매핑: empty/too_long=400, rate_limited=429, insert_failed=500

**관리자 API**: `src/app/api/admin/cheer/[id]/route.ts`
- `PATCH` — `requireAdminApi` + 대상 cheer의 `org_id === tenant.id` 이중 검증
- Body: `{ hidden: boolean, reason?: string }` (reason 500자 제한)

### 4. UI

**공개 페이지**: `CheerWall` + `CheerForm`
- `CheerWall` (서버 컴포넌트): 초기 50건 SSR + donor 세션 동시 fetch (`Promise.all`)
- `CheerForm` (클라이언트): 비로그인 시 로그인 CTA / 로그인 시 textarea + "익명으로 표시" 체크 + 남은 글자 수 실시간 표시
- 상대 시간 포맷("3분 전", "2일 전", 7일 초과는 날짜)
- `campaigns/[slug]/page.tsx`의 **두 경로 모두** CheerWall 삽입 (BlockRenderer / legacy)

**관리자 검수**: `/admin/cheer` + `CheerModerationList`
- 최근 200건, 캠페인 제목 / 원본 회원 이름 / 익명 배지 / 숨김 배지 표시
- 숨김 처리 시 선택적 사유 prompt → PATCH 후 `router.refresh()`
- 사이드바 "캠페인" 그룹에 "응원 메시지 검수" 링크 추가

---

## 남은 리스크 (4건)

### 중간

#### G-108. 공개 GET에 rate limit 없음
- `GET /api/cheer`는 무인증 공개 엔드포인트. 크롤러가 캠페인 단위로 루프 돌리면 부하 발생 가능
- 현재 limit 파라미터 상한(200)만 걸려있음
- **해결**: IP 기준 `rateLimit('cheer:get:${ip}', 60, 60_000)` — 분당 60회 (일반 사용자엔 영향 없음)
- **우선순위**: 중간 (SEO/소셜봇 영향 측정 후 조정)

#### G-109. 욕설/스팸 자동 필터 부재
- 현재 방어는 길이 제한 + 1시간 3건 + admin 수동 숨김뿐
- 부적절 표현은 게시된 뒤 admin이 발견할 때까지 공개됨
- **해결**: 한국어 비속어 사전 기반 자동 점수화 → 점수 ≥ 임계값이면 `published=false`로 INSERT (관리자 승인 후 공개). 또는 OpenAI moderation API (유료)
- **우선순위**: 중간 (유입량 증가 시 우선 처리)

### 낮음

#### G-110. 응원 메시지 페이지네이션/무한스크롤 미지원
- 현재 50건 초기 렌더 + 더 보기 없음. 캠페인당 응원 수가 수백 건을 넘기 전까지는 문제 없음
- **해결**: `?before=<createdAt>` 커서 기반 추가 fetch + 클라이언트 "더 보기" 버튼
- **우선순위**: 낮음 (트래픽/응원량 누적 후)

#### G-111. 임팩트 페이지 / 도너 홈 연동 없음
- 자기 응원 히스토리를 donor 쪽에서 보거나 수정/삭제할 수 없음
- 현재 단계에서는 "한 번 쓴 응원은 수정 불가"가 공공성 보호 측면에서 낫다고 판단해 의도적으로 생략
- **해결(옵션)**: `/donor/cheer` — 자기가 쓴 응원 목록 + 본인 삭제(soft-delete=hidden+self) 기능
- **우선순위**: 낮음 (UX 피드백 누적 후 결정)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **159 passed** (+10 cheer, 무관 storage 2건 환경 실패) |
| 신규 마이그레이션 | 1 (`cheer_messages`) |
| 신규 lib | 1 (`cheer/messages.ts`) |
| 신규 API | 2 (`/api/cheer`, `/api/admin/cheer/[id]`) |
| 신규 페이지 | 1 (`/admin/cheer`) |
| 신규 컴포넌트 | 3 (`CheerWall`, `CheerForm`, `CheerModerationList`) |
| 수정 페이지 | 1 (`campaigns/[slug]/page.tsx` 두 경로 모두) |
| 수정 컴포넌트 | 1 (admin sidebar 링크 추가) |
| 빌드 | 성공 |

---

## Phase 5 완료 선언

Phase 5 원 계획 4개 하위 항목 모두 완료:
1. ✅ 임팩트 페이지 고도화 (5-A)
2. ✅ 초대/공유 프로그램 (5-B)
3. ✅ 정기후원 업그레이드/다운그레이드 (5-C)
4. ✅ 후원자 응원 메시지 벽 (5-D, 이번)

### 다음 후보

- **Phase 6-A — 운영 인사이트**: G-105(변경 이력 admin 대시보드) + G-108(공개 GET rate limit) + G-109(비속어 필터)
- **Phase 6-B — 후원자 감사 플로우 확장**: G-106(업/다운 변경 감사 이메일) + G-111(donor 본인 응원 관리)
- **Phase 6-C — 공유 성장**: G-103(기관명 명시 초대 카피) + G-98(OG 이미지 캐시/폰트) — 초대 → 공유 카드 → 공개 캠페인 응원 → 재방문의 고리 강화
