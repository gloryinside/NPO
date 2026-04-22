# GAP 분석 — Phase 5-C 정기후원 업/다운그레이드 (2026-04-22)

Phase 5-B 초대/공유에 이어 Phase 5-C에서 **정기후원 금액 변경 플로우**를 고도화했다.
단순 amount UPDATE였던 기존 changeAmount를 이력 기반으로 재설계하고,
업/다운그레이드 개념, 제안 금액, 연 환산 영향 프리뷰, 변경 이력 뷰를 추가했다.

---

## 구현 개요

### 1. 데이터 인프라

**신규 마이그레이션**: `20260422000004_promise_amount_changes.sql`
- 테이블: `promise_amount_changes (id, org_id, promise_id, member_id, previous_amount, new_amount, direction, actor, actor_id, reason, created_at)`
- CHECK: `direction IN ('up','down','same')`, `actor IN ('member','admin','system')`
- 인덱스 3종: promise/org/member 기준 + created_at DESC — 단일/조직/회원 별 시계열 조회 최적
- 스키마 의미: **promises.amount는 항상 최신값만 보관**, 시계열 추적은 이 테이블 단일 원천

### 2. 공용 lib (`src/lib/promises/amount-change.ts`)

핵심 함수 3개 + 10개 단위 테스트(`tests/unit/promises/amount-change.test.ts`, 10/10 passed):

- `classifyDirection(prev, next)` — `'up' | 'down' | 'same'` 분류
- `changePromiseAmount({...})` — 트랜잭션 유사 흐름
  1. 범위 가드: `MIN_PROMISE_AMOUNT=1,000` / `MAX_PROMISE_AMOUNT=100,000,000`
  2. `promises.amount` UPDATE (실패 시 즉시 반환)
  3. 미청구 `payments.amount` 동기화 (`pay_status='pending' AND toss_payment_key IS NULL`)
  4. `promise_amount_changes` INSERT (실패해도 주 변경은 성공 반환, `historyId=null`)
- `listAmountChanges(supabase, promiseId)` — 최신순 이력 반환

**설계 노트**: Supabase JS SDK는 진짜 트랜잭션을 지원하지 않으므로 순서를 "영향도 큰 것 먼저"로 배치. promises UPDATE 이후 payments 동기화 실패는 다음 청구 사이클에서 재계산되어 복구 여지 있음, 이력 INSERT 실패는 사용자에게 보일 가치가 없으므로 조용히 흡수.

### 3. API

**변경**: `src/app/api/donor/promises/[id]/route.ts`
- changeAmount 블록을 lib 호출로 교체
- `body.reason`(500자 이내) 수용
- 동일 금액 거부 (클라이언트와 서버 이중 가드)
- 에러 코드 매핑: `invalid_amount / below_minimum / above_maximum / update_failed`
- 응답에 `direction`, `previousAmount`, `historyId` 포함 — UI가 토스트/피드백에 활용 가능

**신규 API**: `GET /api/donor/promises/[id]/amount-history`
- `getDonorSession` 인증 + 소유권 이중 검증 (`member_id + org_id eq`)
- 본인 소유 약정이 아니면 404
- `{ history: AmountChangeRecord[] }` 반환

### 4. UI

**신규 컴포넌트**: `src/components/donor/promises/AmountChangeDialog.tsx`
- 탭 2개: "금액 변경" / "변경 이력"
- 입력란 + **빠른 선택 칩 6개**: +1만 / +3만 / +5만 / -1만 / 2배 / 절반
- 실시간 영향 프리뷰 카드
  - direction별 배경색 (up=green / down=red / same=neutral)
  - `formatDelta`: `+20,000원` / `-10,000원`
  - `yearlyImpact`: 연 환산 금액 (`newAmount * 12`)
  - "다음 결제일부터 N원으로 청구됩니다" 문구
- 변경 사유 입력 (선택, 500자 maxLength)
- 제출 버튼 라벨이 direction에 따라 바뀜: `업그레이드 / 다운그레이드 / 변경`
- 이력 탭: 처음 열 때만 `/amount-history` fetch, 각 행에 방향 배지 + prev→new + 상대 날짜 + reason

**변경**: `src/app/(donor)/donor/promises/page.tsx`
- 기존 인라인 다이얼로그 + state 3개(`amountInput`, `amountError`, handler)를 `AmountChangeDialog`로 위임
- "금액 변경" 버튼 클릭 → 다이얼로그 오픈, 제출 후 `fetchPromises()` 재호출

---

## 남은 리스크 (3건)

### 중간

#### G-105. 변경 이력 admin 대시보드 부재
- 후원자는 자기 약정 이력을 볼 수 있지만 기관은 조직 전체 변경 추이(업/다운 비율, 월별 평균 변동)를 볼 지점이 없음
- 이력 테이블의 `idx_pac_org` 인덱스는 이미 준비되어 있음
- **해결**: `/admin/promises/changes` 대시보드 — 월별 up/down 카운트, 평균 증감액, 가장 큰 변동 약정 Top 10
- **우선순위**: 중간 (운영 인사이트용)

#### G-106. 업/다운 변경 시 후원자 감사 이메일/알림 없음
- 현재는 UI에서 성공 배너만 보임 → 재방문 동기 없음
- Phase 4-A `email_notifications_log`를 재사용해 `kind='amount_change_up'|'amount_change_down'` 종류 추가 가능
- **해결**: up일 때는 "감사합니다 + 임팩트 강조", down일 때는 "계속 함께해주셔서 감사합니다"
- **우선순위**: 중간 (업그레이드 유지율/다운그레이드 이탈 방지에 직결)

### 낮음

#### G-107. 월별 변경 횟수 rate limit 없음
- 한 약정을 악의적으로 초당/분당 수십 번 변경해도 막힘 없음
- 레이스는 없지만 불필요한 이력 폭증 가능
- **해결**: `rateLimit('promise:change:${memberId}:${promiseId}', 5, 3600_000)` — 시간당 5회
- **우선순위**: 낮음 (현실적 악용 시나리오 드묾)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **149 passed** (+10 amount-change, 저장소 통합 테스트 2건 환경 실패 무관) |
| 신규 마이그레이션 | 1 (`promise_amount_changes`) |
| 신규 lib | 1 (`promises/amount-change.ts`) |
| 신규 API | 1 (`/api/donor/promises/[id]/amount-history`) |
| 수정 API | 1 (`/api/donor/promises/[id]` — changeAmount lib 연결) |
| 신규 컴포넌트 | 1 (`AmountChangeDialog` — 업/다운 언어 + 프리뷰 + 이력) |
| 수정 페이지 | 1 (`/donor/promises` — 다이얼로그 위임) |
| 빌드 | 성공 |

---

## Phase 5 진행 상황

1. ✅ 임팩트 페이지 고도화 (5-A)
2. ✅ 초대/공유 프로그램 (5-B)
3. ✅ 정기후원 업그레이드/다운그레이드 (5-C, 이번)
4. 후원자 커뮤니티 — 응원 메시지 월 (5-D)

**다음 추천: 5-D 후원자 커뮤니티** — 후원자 간 응원 메시지로 리텐션 보완. 또는 Phase 6-A(변경 이력 admin 대시보드 G-105)로 운영 인사이트를 먼저 채우는 선택도 가능.
