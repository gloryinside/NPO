# Phase 7-D-1 — 관리자 회원 허브 + 회원/비회원 구분 (2026-04-22)

## 목적

관리자가 후원자 개별 응대 시 "이 사람이 로그인 가능한 회원인가, 연결되지 않은
비회원인가"를 한눈에 파악하고, 비회원이면 **초대 메일 한 번 클릭**으로
로그인 계정 연결을 유도할 수 있게 한다. 나아가 목록·상세 요약에 **미납 현황**을
노출해 수납 관리 동선을 단축한다.

본 스펙은 Phase 7-D(수납 관리 고도화)의 **1/3 단계**다.
- 7-D-1 (이 문서): 회원 허브 + 목록 필터
- 7-D-2: 수납 트랜잭션 (수기 납부/환불/재시도) — 별도 spec
- 7-D-3: My Page 집약 — 별도 spec

---

## 회원/비회원의 정의

현재 스키마에서 모든 후원자는 `members` row를 가진다. 단 **로그인 계정 연결 여부**는
`members.supabase_uid` 컬럼 하나로 표현된다:

- `supabase_uid IS NOT NULL` → **회원** (본인이 로그인해 MyPage 접근 가능)
- `supabase_uid IS NULL` → **비회원** (관리자가 수기/CSV 등록했거나 단발 기부로 자동 생성된 row)

이 정의를 DB 컬럼으로 이중화하지 않고, **계산 필드**로만 처리한다.

---

## 설계 요약

| 영역 | 신규/수정 | 범위 |
|---|---|---|
| Lib | 신규 `src/lib/members/account-state.ts` | 4상태(linked/invited/invite_expired/unlinked) 계산, 배치 지원 |
| Lib | 수정 `src/lib/email/notification-log.ts` | `NotificationKind`에 `'member_invite'` 추가 |
| Template | 수정 `src/lib/email/default-templates.ts` | `member_invite` 기본 템플릿 추가 |
| API | 신규 `POST /api/admin/members/[id]/invite` | 에러 분기 4종, 3일 쿨다운, 감사 로그 |
| UI | 수정 `src/app/(admin)/admin/members/page.tsx` | 탭 4개 확장, 행 뱃지, 배치 state 해결 |
| UI | 수정 `src/app/(admin)/admin/members/[id]/page.tsx` | 헤더 뱃지+액션, 요약 카드 3→5, 계정 상태 섹션 |
| UI | 신규 `src/components/admin/members/invite-button.tsx` | 클라이언트 액션 버튼 |
| 테스트 | 신규 `tests/unit/members/account-state.test.ts` | 4상태 × 엣지케이스 |

**신규 마이그레이션: 0** / **신규 테이블: 0** / **신규 컬럼: 0**

---

## 1. 데이터 계층

### 1.1 Account State 정의

```ts
export type AccountState =
  | 'linked'          // supabase_uid 존재 — 로그인 가능 회원
  | 'invited'         // 비회원 + 최근 30일 내 member_invite 메일 발송 성공
  | 'invite_expired'  // 비회원 + member_invite 이력 있으나 30일 경과
  | 'unlinked'        // 비회원 + 초대 이력 없음
```

- `inviteWindowDays`: **30**
- 미납 판정: `pay_status IN ('unpaid','failed')` — 두 상태 모두 "결제 실패한 상태"로 간주

### 1.2 공용 헬퍼 lib

**파일**: `src/lib/members/account-state.ts`

```ts
export async function resolveAccountState(
  supabase: SupabaseClient,
  memberId: string,
  opts: { supabaseUid: string | null; inviteWindowDays?: number }
): Promise<AccountState>

export async function resolveAccountStatesBatch(
  supabase: SupabaseClient,
  members: Array<{ id: string; supabase_uid: string | null }>,
  opts?: { inviteWindowDays?: number }
): Promise<Map<string, AccountState>>
```

**핵심 로직**:
1. `supabaseUid != null` → `linked` 즉시 반환 (invite 조회 불필요)
2. 비회원의 경우 `email_notifications_log`에서 `ref_id=memberId AND kind='member_invite' AND status='sent'` 최신 1건 조회
3. 이력 없음 → `unlinked`
4. `sent_at > now() - 30d` → `invited`
5. 그 외 → `invite_expired`

**배치 버전**: `ref_id IN (...)` 한 번으로 끝내고 memberId → 최신 sent_at 맵 생성.

### 1.3 NotificationKind 확장

```ts
// src/lib/email/notification-log.ts
export type NotificationKind =
  | 'churn_risk_weekly'
  | 'campaign_closed_thanks'
  | 'amount_change_up'
  | 'amount_change_down'
  | 'member_invite'  // ← 추가
```

---

## 2. UI 바인딩

### 2.1 목록 페이지 `/admin/members`

**탭 변경**: `list | source` → `all | linked | unlinked | source` (4개)

```
[전체] [회원(로그인)] [비회원] [유입경로]
```

- 기본값 `all` (기존 URL 하위호환: `tab=list` → `all`로 매핑)
- `linked`: `.is('supabase_uid', null) == false` (즉 NOT NULL)
- `unlinked`: `.is('supabase_uid', null) == true`
- 기존 필터(`q`/`status`/`payMethod`/`promiseType`)는 모든 탭에서 동작 (AND 조건)

**행 뱃지 인라인 표시**:

이름 컬럼 셀에 인라인 뱃지:
- `linked` → `<Badge style=positive>회원</Badge>`
- `unlinked` → `<Badge style=muted>비회원</Badge>`
- `invited` → `<Badge style=muted>비회원</Badge> <Badge style=accent>초대됨</Badge>`
- `invite_expired` → `<Badge style=muted>비회원</Badge> <Badge style=warning>초대 만료</Badge>`

구현: 페이지 쿼리로 받은 members 배열을 `resolveAccountStatesBatch`에 넘겨 Map 계산 후 `MemberList` props로 전달.

### 2.2 상세 페이지 `/admin/members/[id]`

**헤더 확장** (기존 member_code · name · MemberStatusBadge · 영수증 버튼 옆):

```
[MEM-2024-0123]  홍길동  [활성] [회원]            [영수증 발급]
                                또는
                                [비회원]           [초대 메일 보내기]
```

- 회원이면 기존 "영수증 발급" 버튼 유지
- 비회원 + 이메일 있음: "영수증 발급" + `<InviteButton>` 컴포넌트
- 비회원 + 이메일 없음: "영수증 발급" + `<span class="text-muted">이메일 없음 · 초대 불가</span>`

**요약 카드 3 → 5**:

```
[총 납입액] [납입 건수] [활성 약정] [미납액] [미납 건수]
```

- 미납액/건수 계산: 이미 로드된 `payments` 배열에서 `pay_status IN ('unpaid','failed')` 필터
- 쿼리 추가 **없음**
- `미납 건수 > 0`일 때 값 색: `var(--warning)` (negative가 아님 — 관리자에게 "주의" 수준)

**기본정보 탭 상단에 "계정 상태" 섹션 추가**:

`MemberEditForm` 바로 위에 read-only 박스:

```
계정 상태
─────────
회원 (로그인 연결됨)

  ─ 또는 ─

비회원 (로그인 계정 미연결)
최근 초대 메일: 2026-04-15 (7일 전)
[초대 메일 재발송] (쿨다운 남았으면 disabled + "N일 후 가능")
```

### 2.3 URL 쿼리 하위호환

기존 `/admin/members?tab=list`가 외부 링크로 존재할 수 있으므로 다음 매핑:
- `tab=list` → `tab=all`로 정규화 (redirect 불필요, 컴포넌트에서 알아서 매핑)
- `tab=source` → 유지 (유입경로 탭)

---

## 3. 초대 메일 API

### 3.1 엔드포인트

**`POST /api/admin/members/[id]/invite`**

```
Request: (body 없음)
Response:
  200 { ok: true, sentAt: "2026-04-22T..." }
  400 { error: "ALREADY_LINKED" }
  400 { error: "NO_EMAIL" }
  404 { error: "NOT_FOUND" }
  429 { error: "COOLDOWN", retryAt: "2026-04-25T..." }
  500 { error: "SEND_FAILED" }
```

### 3.2 흐름

```
1. requireAdminApi() — admin 인증 + tenant 격리
2. SELECT member WHERE id AND org_id → 없으면 404 NOT_FOUND
3. member.supabase_uid != null → 400 ALREADY_LINKED
4. member.email 없음/빈 문자열 → 400 NO_EMAIL
5. wasSentForRefWithin(sb, member.id, 'member_invite', 3*24*60분)
   → true 이면 최근 sent_at 재조회 후 retryAt 계산 → 429 COOLDOWN
6. resolveEmailTemplate(tenant.id, 'member_invite') — 없으면 default fallback
7. 템플릿 렌더링 + sendEmail
8. logNotification(kind='member_invite', ref_id=member.id, status='sent'|'failed')
9. audit_logs INSERT (action='member_invite_sent', target_type='member', target_id=member.id)
10. 200 { ok, sentAt }
```

### 3.3 쿨다운

- **3일 = 4320분** 윈도우
- 저장소: `email_notifications_log` 재사용 (새 테이블 없음)
- 검사: `wasSentForRefWithin(sb, memberId, 'member_invite', 4320)` — 이미 구현됨

### 3.4 이메일 템플릿 — member_invite

**변수**: `{orgName}`, `{memberName}`, `{loginUrl}`

**제목**: `{orgName} 후원자 페이지에 로그인해보세요`

**본문 (HTML, 기본 템플릿만 정의 — 기관별 커스텀은 email_templates 테이블로 덮어쓰기)**:

```
안녕하세요, {memberName}님.

{orgName}에 후원해주셔서 감사합니다. 후원자 전용 페이지에 로그인하시면:
 • 지금까지의 후원 내역 확인
 • 기부금 영수증 발급
 • 정기후원 약정 관리

를 편리하게 하실 수 있습니다.

[로그인 하러 가기]({loginUrl})

로그인 시 회원님의 이메일({memberEmail})로 받으신 인증 코드를 입력해주세요.
기존 후원 내역이 자동으로 연결됩니다.

— {orgName} 드림
```

**`loginUrl`**: `${origin}/donor/login?email=${encodeURIComponent(member.email)}`

(`email` 쿼리는 donor-login UI가 이미 지원하지 않으면 단순 `/donor/login`으로 폴백 — 구현 단계에서 확인.)

### 3.5 감사 로그

기존 `audit_logs` 테이블 있으면:
- `action = 'member_invite_sent'`
- `target_type = 'member'`, `target_id = member.id`
- `actor_id = admin user id`
- `metadata = { email: member.email }`

없으면 `console.info` 로깅으로 대체 (구현 시 확인).

### 3.6 UI 버튼

**`src/components/admin/members/invite-button.tsx`** (클라이언트):

```tsx
'use client'
export function InviteButton({ memberId, lastSentAt, email }: Props) {
  // useTransition 낙관적 UI
  // 성공: "초대 메일 발송됨" + router.refresh()
  // 실패: 에러 토스트/인라인
  // 쿨다운: "N일 후 재발송 가능" 계산해 disabled 표시
}
```

`lastSentAt`은 서버에서 prop으로 넘김 (state 배치 조회 결과 재사용).

---

## 4. 테스트

### 4.1 유닛 — `tests/unit/members/account-state.test.ts`

- `resolveAccountState` 4상태 각각:
  - linked (supabase_uid 존재)
  - unlinked (이력 없음)
  - invited (sent_at = now - 5d)
  - invite_expired (sent_at = now - 40d)
- `resolveAccountStatesBatch` — 10명 혼합 상태, 반환 Map 크기·값 검증
- 엣지: empty array → 빈 Map, supabase_uid != null인데 invite 이력도 있는 경우 → linked 우선

### 4.2 API 분기 — `tests/unit/api/member-invite.test.ts`

- Mock supabase/sendEmail로 4종 에러 분기 확인:
  - ALREADY_LINKED
  - NO_EMAIL
  - COOLDOWN (sent_at = now - 1d)
  - SEND_FAILED (sendEmail returns success: false)
- 성공 경로: logNotification + audit_log 호출 검증

**통합 테스트는 생략** — 실 이메일 발송은 QA 단계 수동 검증.

---

## 5. 되돌리기 가능성

모든 변경이 **추가 only** — 기존 동작 해치지 않음:
- UI 탭 확장: `list` → `all` 라벨만 변경, 필터 로직 추가만
- API 신규: 호출 없으면 동작 없음
- 템플릿 신규 kind: 기존 kind 사용처에 영향 없음
- lib 함수 신규: 호출하는 쪽에서만 의존

되돌리기: git revert로 충분. DB 변경 없으므로 마이그레이션 롤백도 없음.

---

## 6. 다음 단계

- Phase 7-D-2: 수납 트랜잭션 (수기 납부 기록, 환불, 결제 재시도) — 별도 spec
- Phase 7-D-3: My Page 집약 — 별도 spec (donor 측 UX)

이 순서가 바뀌거나 합쳐지지 않도록 주의. 금전 흐름(7-D-2)은 감사/롤백 설계가
별도로 필요하고, MyPage(7-D-3)은 이 spec에서 확정한 account-state를 donor UI에도
노출할 수 있어 가장 나중이 적절하다.
