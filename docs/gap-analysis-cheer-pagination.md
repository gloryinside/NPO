# GAP 분석 — G-110 cheer 페이지네이션 (2026-04-23)

응원 메시지 벽(Phase 5-D)은 초기 50건만 SSR 렌더하고 "더 보기"가 없어,
캠페인당 응원이 수십~수백 건 누적되면 과거 메시지가 영영 보이지 않았다.
커서 기반 페이지네이션으로 해소.

---

## 구현 개요

### 1. lib 확장

**변경**: `src/lib/cheer/messages.ts` — `listPublicCheerMessages`에 `before?: string | null` 추가
- `before` 주어지면 `WHERE created_at < $before` 추가
- 인덱스 `idx_cheer_campaign_created`가 `(campaign_id, created_at DESC)` 순서라 range-scan 적중
- 기존 동작(before 없음)은 그대로 — 기본값 없이 optional

### 2. API

**변경**: `GET /api/cheer?campaignId=...&before=<iso>&limit=50`
- `before` 파싱 시 `Date.parse` 유효성 검증 (invalid면 무시)
- 응답에 `nextCursor: string | null` 추가:
  - `messages.length === limit`이면 마지막 행의 `createdAt`
  - 아니면 `null` — 더 없음

### 3. UI

**신규 클라이언트 컴포넌트**: `src/components/cheer/CheerList.tsx`
- props: `initialMessages`, `initialNextCursor`, `campaignId`, `pageSize`
- `useState`의 initial 값으로 서버 SSR 결과를 seed — 부모 re-render에도 사용자가 로드한 추가분 보존
- "더 보기" 버튼: loading/error 상태 UI + `role="alert"` 에러
- 빈 리스트면 "아직 등록된 응원 메시지가 없습니다" 안내

**리팩토링**: `CheerWall` (서버 컴포넌트)
- 리스트 렌더링을 `CheerList`에 위임
- 초기 `nextCursor` 계산(messages.length === 50일 때만 cursor 전달)
- 헤더 카운트 문구를 상황별로 조정:
  - 더 보기 가능: "최근 50개 표시"
  - 전체 50개 이하: "총 N개"

### 4. 테스트

**추가**: `tests/unit/cheer/messages.test.ts` — 기존 stub에 `chain.lt = ret` 한 줄 + 신규 spy stub 3 테스트
- before 없으면 `.lt` 호출 안 함
- before 있으면 `.lt('created_at', cursor)` 1회 호출
- before === null도 호출 안 함

---

## 남은 리스크 (2건)

### 낮음

#### G-125. 동일 `created_at` tie-break 부재
- Postgres timestamp는 마이크로초 해상도라 실무상 충돌 드묾
- 완벽 결정성을 위해 `(created_at, id)` 복합 커서를 쓰려면 SQL 표현식이 복잡해짐
- **해결(옵션)**: `.order('created_at', desc).order('id', desc)` + `.lt('created_at', cur).or('created_at.eq.cur,id.lt.lastId')`
- **우선순위**: 낮음 (현재 규모에서 영향 無)

#### G-126. 헤더 카운트가 서버 SSR 시점 기준
- "최근 50개 표시"는 정확하지만 "총 N개" 숫자는 SSR 시점 기준 — 클라이언트에서 더 로드해도 갱신 없음
- **해결(옵션)**: count 쿼리 서버 prefetch → 헤더에도 클라이언트 state 전달
- **우선순위**: 낮음 (UX 혼란 저위험)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **313 passed** (+3: cheer/messages pagination) |
| 수정 lib | 1 (`cheer/messages` — before 파라미터) |
| 수정 API | 1 (`/api/cheer` — before + nextCursor) |
| 신규 컴포넌트 | 1 (`CheerList` — 클라이언트) |
| 수정 컴포넌트 | 1 (`CheerWall` — CheerList 위임) |
| 마이그레이션 | 0 (기존 `idx_cheer_campaign_created` 재활용) |
| 빌드 | 타입체크 통과 |
