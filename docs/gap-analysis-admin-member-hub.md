# GAP 분석 — Phase 7-D-1 관리자 회원 허브 + 회원/비회원 구분 (2026-04-22)

Phase 7-D 수납 관리 고도화 3단계 중 1/3.
Spec: `docs/2026-04-22-admin-member-hub-design.md`.

회원/비회원을 `members.supabase_uid IS NULL` 여부로 정의하고, 기존 스키마에
단 한 줄의 컬럼·테이블도 추가하지 않고 4가지 계정 상태를 계산 필드로
관리한다.

---

## 구현 개요

### 1. 데이터 계층

**신규 lib**: `src/lib/members/account-state.ts`
- `AccountState = 'linked' | 'invited' | 'invite_expired' | 'unlinked'`
- `resolveAccountState(sb, memberId, { supabaseUid, inviteWindowDays=30 })`
  - `supabaseUid != null` → `linked` 즉시 단락 (DB 쿼리 없음)
  - 비회원은 `email_notifications_log` 최신 1건 조회 → 30일 기준 `invited`/`invite_expired`/`unlinked` 판정
- `resolveAccountStatesBatch(sb, members[])` — 목록 페이지용
  - `.in('ref_id', memberIds)` 쿼리 1회로 N명 상태 계산
  - linked 전원 시 DB 쿼리 없음
- **테스트**: 10/10 pass — 4상태 + 쿨다운 override + 빈 배열 + 전원 linked 단락 + 다중 sent 이력 최신 선택

**notification kind 확장**: `NotificationKind`에 `'member_invite'` 추가 (`src/lib/email/notification-log.ts`)

**audit action 확장**: `AuditAction`에 `'member.invite'` 추가 (`src/lib/audit.ts`)

### 2. 이메일 템플릿

**수정**: `src/lib/email/default-templates.ts`
- `ScenarioKey`에 `'member_invite'` 추가
- 기본 템플릿: 후원자 페이지 안내 + `{loginUrl}` 클릭 유도
- 변수: `{name}`, `{orgName}`, `{email}`, `{loginUrl}`
- 기관별 커스터마이징은 기존 `email_templates` 테이블로 자동 덮어쓰기 (별도 마이그레이션 불필요)

### 3. Invite API

**신규**: `POST /api/admin/members/[id]/invite`
- `requireAdminApi()` + tenant 격리
- 에러 분기 5종:
  - `NOT_FOUND` (404) — tenant 소속 아님
  - `ALREADY_LINKED` (400) — `supabase_uid` 이미 있음
  - `NO_EMAIL` (400) — `member.email` null/빈 문자열
  - `COOLDOWN` (429) + `retryAt` — 최근 3일(4320분) 내 발송 이력
  - `SEND_FAILED` (500) — `sendEmail` 실패
- 성공: `resolveTemplate` → `sendEmail` → `logNotification(kind='member_invite')` → `logAudit('member.invite')` → `200 { ok, sentAt }`
- **쿨다운 저장소는 `email_notifications_log` 재사용** — 신규 테이블 없음
- **loginUrl**: `${proto}://${host}/donor/login?email=...` (x-forwarded-host 기반)

### 4. UI 바인딩

**목록 페이지** (`src/app/(admin)/admin/members/page.tsx`)
- 탭: `list|source` → `all|linked|unlinked|source` (4개)
- 하위호환: `tab=list` → `all`로 내부 매핑 (기존 링크 깨지지 않음)
- `linked` 탭: `.not('supabase_uid', 'is', null)` 필터
- `unlinked` 탭: `.is('supabase_uid', null)` 필터
- 기존 필터(`q`/`status`/`payMethod`/`promiseType`)는 4개 탭 모두에서 AND 조건으로 동작
- 페이지에서 `resolveAccountStatesBatch` 호출 후 `MemberList`에 `accountStates: Record<id, state>` 전달

**목록 행 뱃지** (`src/components/admin/member-list.tsx`)
- 이름 셀 옆 인라인 뱃지 — 컬럼 추가 없음 (테이블 width 보존)
- 공용 컴포넌트 `AccountStateBadge`로 일관된 시각 언어

**상세 페이지** (`src/app/(admin)/admin/members/[id]/page.tsx`)
- 헤더: member_code + name + MemberStatusBadge **+ AccountStateBadge**
- 헤더 오른쪽 액션: 비회원 + 이메일 있음 → `InviteButton` 표시, 이메일 없음 → "이메일 없음 · 초대 불가", 회원 → 기존 영수증 버튼만
- 요약 카드 3 → 5: 총 납입액, 납입 건수, 활성 약정, **미납액**, **미납 건수**
  - 미납 = `pay_status IN ('unpaid','failed')` (쿼리 추가 없음, 기존 payments 배열 필터)
  - 미납 건수 > 0일 때 `var(--warning)` 색으로 하이라이트
- 기본정보 탭 상단에 "계정 상태" 섹션 추가 — 뱃지 + 최근 초대일 + InviteButton

**InviteButton** (`src/components/admin/members/invite-button.tsx`, 클라이언트)
- `useTransition` 낙관적 UI
- 쿨다운 남은 경우 disabled + "N일 후 재발송 가능" 표시
- 에러 5종 한국어 매핑
- 성공 시 `router.refresh()` — 서버 쿼리 재실행으로 상태 자동 갱신

**공용 뱃지** (`src/components/admin/members/account-state-badge.tsx`)
- 4상태 → 색·라벨·보조 뱃지 조합을 presentation 컴포넌트로 캡슐화
- `linked` → 단일 positive 뱃지
- `unlinked` → muted "비회원" 단일
- `invited`/`invite_expired` → "비회원" + 보조 뱃지(accent/warning)

---

## 설계 대비 실제 범위

| Spec 목표 | 구현 상태 |
|---|---|
| 4상태 lib + 배치 | ✅ 10/10 테스트 |
| kind·scenario·action enum 확장 | ✅ 3곳 모두 |
| Invite API (에러 5종 + 쿨다운 + 감사) | ✅ |
| 이메일 템플릿 기본값 | ✅ Tiptap JSON + 커스텀 오버라이드 호환 |
| 목록 탭 4개 + 뱃지 + 배치 조회 | ✅ |
| 상세 헤더 뱃지 + 요약 5카드 + 계정상태 섹션 | ✅ |
| 신규 마이그레이션 | **0** |
| 신규 테이블/컬럼 | **0** |

---

## 남은 리스크 (3건)

### 중간

#### G-121. 초대 메일의 `/donor/login?email=` 쿼리 수신 UI
- 현재 donor login 페이지가 `?email=` 쿼리를 읽어 자동 입력하는지 확인 필요
- **해결**: login-form.tsx에서 `useSearchParams('email')` 읽어 초기값 주입. 없어도 로그인 자체는 동작 (단순 UX 개선)
- **우선순위**: 중간 (초대 전환율에 영향)

### 낮음

#### G-122. 배치 invite 이력 조회의 페이지네이션
- 50명/페이지 기준 `.in('ref_id', 50개)` 는 안전하지만, 만약 목록을 1000명 이상으로 늘릴 경우 IN 절 제한(~65k 인자) 전에 청크 분할 필요
- **해결**: 현재 range(0, 49)로 페이지당 50명 상한 → 당장은 무관. 페이지 크기 증가 시 청크 기능 추가
- **우선순위**: 낮음 (현 구조에서는 발생 불가)

#### G-123. member_invite 템플릿 관리 UI 누락
- `/admin/email-templates`에서 다른 시나리오는 편집 가능하지만, 이번에 추가한 `member_invite`가 목록에 자동 포함되는지 확인 필요
- **해결**: `SCENARIOS` 배열이 UI에 그대로 매핑돼 있다면 자동 포함. 아니라면 UI side의 allowlist 업데이트
- **우선순위**: 낮음 (기본 템플릿으로도 충분히 사용 가능)

---

## 누적 집계

| 범주 | 수치 |
|---|---|
| 테스트 | **176 passed** (신규 10 — account-state) |
| 변경 파일 | 6 (default-templates, notification-log, audit, members/page, members/[id]/page, member-list) |
| 신규 파일 | 4 (account-state lib + 테스트, invite API, invite-button, account-state-badge) |
| 신규 API | 1 (`POST /api/admin/members/[id]/invite`) |
| 마이그레이션 | 0 |
| 신규 테이블/컬럼 | 0 |
| 빌드 | 성공 |

---

## Phase 7-D-1 완료 선언

- ✅ 회원/비회원 구분을 UI 1급 시민으로 승격 (목록 탭·행 뱃지·상세 헤더)
- ✅ 초대 메일 원-클릭 발송 + 3일 쿨다운 + 감사 로그
- ✅ 미납 요약 카드 2개 추가 — 수납 관리 동선 단축
- ✅ 스키마 변경 없음 → 되돌리기 risk 최소

### 다음 단계

- **Phase 7-D-2**: 수납 트랜잭션 (수기 납부 기록 · 환불 · 결제 재시도)
  - 금전 흐름 — 감사 로그 필수, 롤백 정책, 관리자 권한 재검토
- **Phase 7-D-3**: My Page 집약 (donor 측)
  - 이 Phase에서 확정한 account-state를 donor 본인에게도 노출 가능

### 남은 GAP (차후 반영)

- **G-121**: `/donor/login?email=` 쿼리 수신 UI (중간)
- **G-122**: 배치 조회 페이지네이션 (낮음)
- **G-123**: member_invite 템플릿 관리 UI 편입 확인 (낮음)
