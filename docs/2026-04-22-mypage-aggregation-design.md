# Phase 7-D-3 — MyPage 집약 (2026-04-22)

## 목적

`/donor` 영역을 **집약형 MyPage** 로 재구성한다.

1. **네비게이션 그룹핑**: 평면적 탭 8개를 `[홈] [후원▾] [참여▾] [설정]` 드롭다운으로 축약.
2. **홈 대시보드 풍부화**: "Action Required" 섹션을 최상단에 추가하여 조치 필요 항목을 즉시 인지 + "이번 달 예정 납입" 섹션 추가.

본 스펙은 Phase 7-D(수납 관리 고도화)의 3/3 단계이며, Spec A(테마 토글 + 로고, `2026-04-22-theme-toggle-and-logo-design.md`) 의 **후속 작업**이다. Spec A가 제공하는 라이트/다크 톤에서 MyPage UI가 검증되도록 순서를 맞췄다.

**Phase 7-D-2-b (환불)** 은 별도 후속 스펙으로 분리되어 있다 — 결정 사항: PG 기간 내 전체/부분 취소 로직으로 단순화. 본 스펙 범위 외.

---

## 스코프 고정

| 항목 | 결정 |
|---|---|
| 네비 구조 | `[홈] [후원▾] [참여▾] [설정]` 드롭다운 |
| 후원 그룹 | 약정 / 납입내역 / 영수증 |
| 참여 그룹 | 임팩트 / 응원 / 초대 |
| 계정 | 설정 (드롭다운 없이 단독) |
| 홈 상단 섹션 | Action Required 배너(조건부, 최대 **3종**) |
| Action #1 | 실패 자동결제 — `pay_status='failed' AND retry_count < 3` 건수 |
| Action #2 | 영수증 RRN 미입력 — 올해 paid 중 `receipt_opt_in=true AND rrn_pending_encrypted IS NULL AND receipt_id IS NULL` 건수 |
| Action #3 | 약정 변경 이력 — `promise_amount_changes` 최근 30일, `actor='admin'` 건수 |
| Action #4 (미확인 응원) | **제거** — `cheer_messages` 스키마에 수신자 개념이 없음(작성자만 있음). 기능적 근거 부재. |
| 홈 추가 섹션 | "이번 달 예정 납입" — `promises.pay_day` 기반 계산, 이번 달 미납 건만 |
| DB 마이그레이션 | **0건** |
| 신규 API | 0개 |
| 신규 lib | 2개 — `dashboard-actions.ts`, `upcoming-payments.ts` |
| 신규 컴포넌트 | 2개 — `ActionRequiredBanner`, `UpcomingPaymentsCard` + `DonorNav` 드롭다운 리뉴얼 |
| 기존 페이지 수정 | `/donor/page.tsx` (홈 섹션 재배치), `src/components/donor/donor-nav.tsx` (드롭다운 전환) |
| 제외 (YAGNI) | 초대 보상 대기 배너, 알림 미설정 배너, 임팩트 뱃지 미리보기, Action dismiss, 모바일 bottom nav, "모두 정상" 긍정 배너, 변경 이유 표시 |

**접근성**: 드롭다운은 키보드 탐색 가능(`role="menu"`, `aria-expanded`, `Esc` 닫기). Action 배너 각 항목은 `<a href>` 링크로 상세 페이지 이동(JS 비활성에서도 동작).

---

## 1. 데이터 계층

### 1.1 마이그레이션

**없음.** 본 스펙은 기존 스키마만 사용한다.

- `payments.pay_status`, `payments.retry_count`, `payments.receipt_opt_in`, `payments.rrn_pending_encrypted`, `payments.receipt_id`, `payments.pay_date` — 기존
- `promise_amount_changes.actor`, `promise_amount_changes.created_at`, `promise_amount_changes.member_id` — 기존 (Phase 5-C)
- `promises.type`, `promises.status`, `promises.pay_day`, `promises.amount` — 기존

### 1.2 신규 lib — `src/lib/donor/dashboard-actions.ts`

Action Required 3종 카운트를 단일 함수로 병렬 조회.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardActions {
  failedPayments: number;       // #1 실패 자동결제
  missingRrnReceipts: number;   // #2 영수증 RRN 미입력
  recentAdminChanges: number;   // #3 약정 변경 이력 (30일 admin)
}

export async function getDashboardActions(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<DashboardActions>
```

**내부 구현 (골격)**:

```ts
const currentYear = new Date().getUTCFullYear();
const yearStart = `${currentYear}-01-01`;
const yearEnd = `${currentYear + 1}-01-01`;
const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

const [failed, rrn, changes] = await Promise.all([
  supabase.from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'failed')
    .lt('retry_count', 3),

  supabase.from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .eq('receipt_opt_in', true)
    .is('rrn_pending_encrypted', null)
    .is('receipt_id', null)
    .gte('pay_date', yearStart)
    .lt('pay_date', yearEnd),

  supabase.from('promise_amount_changes')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('actor', 'admin')
    .gte('created_at', thirtyDaysAgo),
]);

return {
  failedPayments: failed.error ? 0 : (failed.count ?? 0),
  missingRrnReceipts: rrn.error ? 0 : (rrn.count ?? 0),
  recentAdminChanges: changes.error ? 0 : (changes.count ?? 0),
};
```

**설계 포인트**:
- `count: 'exact', head: true` → 카운트만 조회(행 페치 없음), 성능 최적.
- 개별 쿼리 에러 시 해당 항목만 `0` 폴백 → 대시보드 전체 장애 방지.
- 모든 쿼리에 **`org_id + member_id` 이중 필터 필수** (admin client 사용으로 RLS 우회되므로 명시 필터가 보안 경계).

### 1.3 신규 lib — `src/lib/donor/upcoming-payments.ts`

이번 달 정기 약정 예정 납입을 계산. DB 저장 없음(계산값).

```ts
export interface UpcomingPayment {
  promiseId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  amount: number;
  scheduledDate: string;  // YYYY-MM-DD
}

export async function getUpcomingPaymentsThisMonth(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<UpcomingPayment[]>
```

**흐름**:

1. 활성 regular promises 조회:
   ```ts
   supabase.from('promises')
     .select('id, campaign_id, amount, pay_day, campaigns(title)')
     .eq('org_id', orgId)
     .eq('member_id', memberId)
     .eq('type', 'regular')
     .eq('status', 'active')
     .not('pay_day', 'is', null);
   ```

2. 이번 달 범위의 paid payment 조회 (promise 별 중복 여부 판정):
   ```ts
   supabase.from('payments')
     .select('promise_id')
     .eq('org_id', orgId)
     .eq('member_id', memberId)
     .eq('pay_status', 'paid')
     .gte('pay_date', monthStart)   // YYYY-MM-01
     .lt('pay_date', nextMonthStart);
   ```
   → `Set<promise_id>` 생성.

3. 각 promise 에 대해 `scheduledDate = YYYY-MM-DD (이번 달, pay_day)` 문자열 생성.

4. **제외 조건**:
   - 이미 이번 달 paid 된 promise (2번의 Set에 포함)
   - `scheduledDate < today` (이미 지난 미납은 Action #1 "실패 자동결제" 배너로 처리되므로 중복 방지)

5. `scheduledDate` 오름차순 정렬, 반환.

**전제**:

- 본 스펙은 **정기 약정을 "월 1회 납입"** 으로 가정한다(현재 `promises` 스키마에 frequency 필드가 없고, `pay_day` 단일 일자만 있음). 만약 향후 주간·격월 등 주기가 도입되면 본 lib의 "이번 달 한 건" 가정 재검토 필요.

**엣지 케이스**:

- `pay_day BETWEEN 1 AND 28` CHECK 이 DB 레벨에서 보장되므로(20260415000004_promises.sql), 2월 말일 등 불일치는 발생 불가.
- 빈 배열 → 홈 대시보드의 "이번 달 예정 납입" 카드 조건부 미노출.

---

## 2. UI 컴포넌트

### 2.1 `DonorNav` 드롭다운 리뉴얼 — `src/components/donor/donor-nav.tsx`

현재는 평면 탭 8개. 드롭다운 구조로 전환.

```ts
interface NavGroup {
  label: string;
  items: Array<{ href: string; label: string }>;
}

const GROUPS: NavGroup[] = [
  {
    label: '후원',
    items: [
      { href: '/donor/promises', label: '약정' },
      { href: '/donor/payments', label: '납입내역' },
      { href: '/donor/receipts', label: '영수증' },
    ],
  },
  {
    label: '참여',
    items: [
      { href: '/donor/impact', label: '임팩트' },
      { href: '/donor/cheer', label: '응원' },
      { href: '/donor/invite', label: '초대' },
    ],
  },
];

// 단독 탭: 홈 `/donor`, 설정 `/donor/settings`
```

**렌더 구조**:
```
[홈]  [후원 ▾]  [참여 ▾]  [설정]
```

**상호작용**:
- 그룹 탭 클릭 → 드롭다운 토글 (`open` state, 컴포넌트 로컬).
- 바깥 클릭 → 닫힘 (`useEffect` + `document.click` 리스너, 마운트/언마운트 시 정리).
- `Escape` 키 → 닫힘.
- 하위 아이템 경로 active → 그룹 탭도 active 스타일(`pathname.startsWith(item.href)`).
- 키보드: `Tab` 포커스 이동, `Enter`/`Space` 로 드롭다운 열기.
- ARIA: `role="menu"` / `role="menuitem"` / `aria-expanded` / `aria-haspopup="menu"`.

**JS 비활성 Fallback**:
- 그룹 탭의 기본 `<button>` 이지만, JS 미로드 상태에서는 첫 하위 링크로 이동하는 `<a href>` 로 **progressive enhancement**: 초기 렌더는 `<a href="/donor/promises">후원</a>` 형태, JS 붙은 뒤 클릭 핸들러가 `preventDefault` 하고 드롭다운을 연다.

**드롭다운 스타일** (토큰 기반):
- 컨테이너: `position: absolute`, 그룹 탭 하단 정렬.
- `background: var(--surface)`, `border: 1px solid var(--border)`, `box-shadow: var(--shadow-card)`, `border-radius: var(--radius)`.
- 아이템: hover 시 `background: var(--surface-2)`, active 시 `color: var(--accent)`.

**모바일** (360~640px):
- 헤더 가로 공간 부족 시 줄바꿈 허용. 햄버거/bottom nav는 **YAGNI 제외**.

### 2.2 `ActionRequiredBanner` — `src/components/donor/dashboard/action-required-banner.tsx`

```ts
interface ActionRequiredBannerProps {
  actions: DashboardActions;
}

export function ActionRequiredBanner({ actions }: ActionRequiredBannerProps): React.ReactElement | null
```

**노출 조건**: 3개 카운트 중 하나라도 `> 0` 이면 렌더. 모두 `0` 이면 `return null`.

**렌더 구조**:
```
┌─────────────────────────────────────────────────┐
│ ⚠️  확인이 필요한 내역이 있습니다                │
│                                                 │
│ • 결제 실패 (2건)           →  [납입내역 보기]  │
│ • 영수증 미발급 (1건)       →  [영수증 신청]    │
│ • 약정 변경 이력 (1건)      →  [약정 보기]      │
└─────────────────────────────────────────────────┘
```

**항목 정의**:

| 조건 | 문구 | 이동 링크 |
|---|---|---|
| `failedPayments > 0` | "결제 실패 ({n}건) — 결제수단 확인이 필요합니다" | `/donor/payments?status=failed` |
| `missingRrnReceipts > 0` | "영수증 미발급 ({n}건) — 연말정산 영수증 발급을 위해 주민번호 입력이 필요합니다" | `/donor/receipts` |
| `recentAdminChanges > 0` | "약정 변경 이력 ({n}건) — 관리자가 최근 30일 내 약정 금액을 변경했습니다" | `/donor/promises` |

**스타일**:
- 컨테이너: `background: var(--warning-soft)`, `border: 1px solid var(--warning)`, `border-radius: var(--radius)`, `padding: 1rem 1.25rem`.
- 아이콘: lucide `AlertCircle`, `color: var(--warning)`.
- 각 항목은 세로 배치(모바일 가독성), 좌측 글머리 점 + 텍스트, 우측 링크 버튼 (`color: var(--warning)`).

**접근성**:
- 컨테이너: `role="region"`, `aria-labelledby="action-required-title"`.
- 각 링크는 `<a href>` SSR 네비게이션(클라이언트 상태 없음).

### 2.3 `UpcomingPaymentsCard` — `src/components/donor/dashboard/upcoming-payments-card.tsx`

```ts
interface UpcomingPaymentsCardProps {
  payments: UpcomingPayment[];
}

export function UpcomingPaymentsCard({ payments }: UpcomingPaymentsCardProps): React.ReactElement | null
```

**노출 조건**: `payments.length > 0` 일 때만 렌더. 빈 배열이면 `return null`.

**렌더 구조**:
```
┌─────────────────────────────────────────────────┐
│ 이번 달 예정 납입                                │
│                                                 │
│ 4월 25일  | 정기후원 ({campaignTitle})  30,000원│
│ 4월 25일  | 정기후원 ({campaignTitle})  10,000원│
│                              소계:   40,000원   │
└─────────────────────────────────────────────────┘
```

- 소계: `payments.reduce((s, p) => s + p.amount, 0)`.
- 일자 포맷: 기존 `formatDate` 유틸 재사용.
- 카드 스타일: 기존 donor 홈 카드 패턴(`background: var(--surface)`, `border: 1px solid var(--border)`) 일치.

### 2.4 홈 페이지 섹션 재배치 — `src/app/(donor)/donor/page.tsx`

**변경 후 구조**:
```
[인사 — {name}님, 안녕하세요!]
[요약 카드 2개 — 누적 후원액 / 활성 약정 수]

(조건부) [Action Required 배너]         ← §2.2 신규

[Quick Links 3 — 임팩트 / 약정 / 납입]   ← 기존 유지

(조건부) [활성 약정 목록]                 ← 기존 유지

(조건부) [이번 달 예정 납입 카드]         ← §2.3 신규

(조건부) [최근 영수증]                   ← 기존 유지

[프로필 섹션]                            ← 기존 유지

[최근 납입 내역 5건]                     ← 기존 유지
```

**쿼리 추가**: 기존 4개 병렬 쿼리 블록에 `getDashboardActions` 와 `getUpcomingPaymentsThisMonth` 를 병렬 추가.

---

## 3. 에러 처리

| 상황 | 처리 |
|---|---|
| `getDashboardActions` 개별 쿼리 실패 | 해당 항목만 `0` 폴백, 나머지 2개는 정상 |
| `getDashboardActions` 전체 실패(DB 다운 등) | 홈 페이지는 Action Required 섹션을 조용히 생략. 다른 섹션(요약 카드 등)은 별도 쿼리라 영향 없음 |
| `getUpcomingPaymentsThisMonth` 실패 | 빈 배열 리턴, 카드 미노출 |
| 드롭다운 네비 JS 비활성 | 그룹 탭의 `<a href>` 가 첫 하위 링크로 이동 (progressive enhancement, §2.1 참조) |
| Action 배너 링크 경로 무효 | 표준 404 처리(기존 Next.js 동작) |

---

## 4. 테스트 계획

### 4.1 단위 테스트

| 파일 | 검증 |
|---|---|
| `tests/unit/donor/dashboard-actions.test.ts` | `getDashboardActions`: 3개 카운트 각 조건(pay_status+retry_count, 올해 범위+RRN null+receipt null, actor='admin'+30일) 정상 / 개별 쿼리 에러 시 해당 항목만 0 폴백 / `org_id + member_id` 필터 누락 시 타인 행이 섞이지 않음 검증 |
| `tests/unit/donor/upcoming-payments.test.ts` | `getUpcomingPaymentsThisMonth`: 이번 달 이미 paid promise 제외 / `pay_day < today` 미납 promise 제외(Action #1 중복 방지) / regular + active 조건 / 오름차순 정렬 / 빈 배열 폴백 |

### 4.2 컴포넌트 테스트

**생략**. Spec A와 동일 근거 — 프로젝트에 React 컴포넌트 테스트 인프라(RTL/vitest-browser) 없음. 기존 테스트 관례(순수 TS 단위)와 일관성. 수동 QA로 대체.

### 4.3 수동 QA 체크리스트 (PR 설명에 복사)

| # | 시나리오 | 기대 |
|---|---|---|
| 1 | 신규 가입자(아무 조건 미해당) 홈 방문 | Action Required 배너 미노출 |
| 2 | `pay_status='failed' AND retry_count=1` 2건 존재 | "결제 실패 (2건)" 노출, 링크 클릭 `/donor/payments?status=failed` |
| 3 | `retry_count=3` 인 failed payment 만 존재 | 배너에 노출 X (retry 한도 도달은 조치 불가) |
| 4 | 올해 paid + receipt_opt_in=true + rrn NULL + receipt_id NULL 1건 | "영수증 미발급 (1건)" 노출 |
| 5 | `promise_amount_changes actor='admin' created_at=어제` 1건 | "약정 변경 이력 (1건)" 노출 |
| 6 | `actor='member'` 변경만 존재 | 배너에 노출 X (본인 변경은 조치 불필요) |
| 7 | 31일 전 admin change 만 존재 | 배너 노출 X (30일 윈도우) |
| 8 | 활성 regular promise `pay_day=25, amount=30000` 이번 달 미납 | 예정 납입 카드에 "{이번달} 25일 / 30,000원" 노출 |
| 9 | 이번 달 이미 paid 된 regular promise | 예정 납입 카드에서 제외 |
| 10 | `pay_day=5` 이고 오늘이 15일이며 미납 | 예정 납입 카드에서 제외 (Action #1 중복 방지) |
| 11 | 드롭다운 네비 "후원 ▾" 클릭 | 하위 3개(약정·납입·영수증) 표시 |
| 12 | 드롭다운 열린 상태 `Escape` 키 | 닫힘 |
| 13 | 드롭다운 열린 상태에서 바깥 클릭 | 닫힘 |
| 14 | `/donor/promises` 페이지에서 네비 | "후원" 그룹 탭 active 스타일 |
| 15 | Tab 키로 네비 탐색 | 포커스 링, Enter로 드롭다운 열림 |
| 16 | 모바일 폭(360px) 네비 | 그룹 탭 4개 + 홈/설정 가로 배치 or 줄바꿈 정상 |
| 17 | 라이트 테마에서 홈·네비 확인 | Spec A 토큰(`--warning-soft` 등) 정상 적용 |
| 18 | 다크 테마에서 홈·네비 확인 | 기존 톤 유지 회귀 없음 |

### 4.4 회귀 리스크

- `/donor/page.tsx` 섹션 재배치 → 기존 쿼리(누적·활성·최근납입·최근영수증) 결과 정상 렌더 여부 체크.
- `DonorNav` 컴포넌트 전면 교체 → 모든 donor 하위 페이지에서 active 스타일 검증(체크 #14).
- Spec A 토큰이 적용된 배너 색(`--warning-soft`, `--warning`) 이 라이트/다크 양쪽에서 대비 충분한지.

---

## 5. 마이그레이션 & 배포

### 5.1 배포 순서

1. Spec A(`2026-04-22-theme-toggle-and-logo-design.md`) 배포 완료 확인
2. 본 스펙 코드 배포 (DB 마이그레이션 없음)
3. 기존 사용자 무영향 — 기존 쿼리/UI는 모두 유지, 신규 섹션만 조건부 추가

### 5.2 롤백

- DB 변경 없으므로 코드 롤백만으로 완전 복원.
- 드롭다운 네비 롤백 시 기존 평면 탭 복귀.

---

## 6. GAP 분석

구현 완료 후 남을 수 있는 **빈틈·리스크·후속 작업**.

### 6.1 기능적 GAP

| # | GAP | 영향 | 대응 시점 |
|---|---|---|---|
| F1 | Action Required "확인했음" dismiss 기능 없음. `failedPayments` 는 재시도 성공 전까지 지속 노출 | 결제수단 갱신을 미룬 사용자에게 알림 피로 | 후속 — `action_dismissals` 테이블 또는 `members` 에 dismiss 타임스탬프 컬럼 |
| F2 | `pay_day < today` 이고 payment row도 없는 사각지대(billing cron 지연, 수동 약정 등)는 Action #1/Upcoming 모두에서 제외됨 | "이번 달 안 낸 것 같은데 안 보임" 혼란 | 후속 — Upcoming 에 "기한 지남 / 미납" 뱃지 항목 추가 |
| F3 | admin 변경 이력 배너에 `reason` 표시 없음 | donor가 "왜 바뀌었는지" 즉시 못 봄 | 후속 — 배너에 최신 1건 reason 발췌, 또는 `/donor/promises` 내 변경 이력 상세 UI |
| F4 | 초대 보상 대기/알림 미설정/임팩트 뱃지 등 Action 후보 추가 | 조치 필요 범위 좁음 | 후속 — Action 종류 확장 시 YAGNI 해제하여 추가 |

### 6.2 UX/접근성 GAP

| # | GAP | 영향 | 대응 시점 |
|---|---|---|---|
| U1 | 모바일 bottom nav 없음. 드롭다운은 데스크탑 최적 | 모바일에서 드롭다운이 하단 절단 가능성 | 후속 — 모바일 bottom tab bar 또는 햄버거 |
| U2 | Action 모두 0일 때 빈 공간(`return null`) | 긍정 피드백("모두 정상") 부재 | YAGNI 유지 |
| U3 | 드롭다운 hover 열기 없음(클릭만) | 데스크탑 사용자 클릭 한 번 더 | YAGNI 유지 |
| U4 | 드롭다운 키보드 포커스 트랩 없음. Tab으로 외부 탈출 가능 | 스크린리더 사용자 포커스 관리 부담 | 후속 — `focus-trap-react` 도입 |

### 6.3 데이터/성능 GAP

| # | GAP | 영향 | 대응 시점 |
|---|---|---|---|
| D1 | 홈 페이지 쿼리 수 증가: 기존 4 + 신규 4(Action 3 + Upcoming 의 promises/payments 2쿼리) = **약 8개 병렬 쿼리** | Supabase 무료 티어 concurrent 한계 근접 가능 | 모니터링 — Supabase dashboard 성능 탭. 필요 시 `donor_dashboard_view` SQL view 통합 |
| D2 | `missingRrnReceipts` 카운트가 receipt annual-batch 결과와 이중 카운트될 가능성. 한 receipt에 여러 payment가 묶이는 케이스가 있으면 조건 조정 필요 | 기존 로직 확인 필요 | 구현 시점 — `src/lib/receipt/annual-batch.ts` 검토, 필요 시 `receipt_id IS NULL` 외 조건 보강 |
| D3 | `promise_amount_changes` 의 `(member_id, created_at DESC)` 인덱스는 있지만 `actor='admin'` 필터는 인덱스 미포함. 행 수준 필터 | member 1명당 변경 이력 수백 건 넘는 극단 케이스에서만 느림 | YAGNI — 성능 이슈 발생 시 부분 인덱스 |
| D4 | `count: 'exact'` 의 `missingRrnReceipts` 쿼리는 `rrn_pending_encrypted IS NULL AND receipt_id IS NULL` 복합 조건이라 인덱스 부재 | 대량 payment 누적 시 full scan | 구현 시점 — `EXPLAIN ANALYZE` 로 검증. 필요 시 부분 인덱스 |

### 6.4 보안/감사 GAP

| # | GAP | 영향 | 대응 시점 |
|---|---|---|---|
| S1 | donor 페이지가 `createSupabaseAdminClient()` 를 사용하여 RLS 우회 — 모든 쿼리가 `org_id + member_id` 이중 필터 필수. 본 스펙은 이를 강제하지만 리뷰가 놓치면 타인 정보 노출 가능 | 심각. 코드 리뷰 필수 체크 | 구현 시점 — PR 리뷰 체크리스트에 명시. 향후 donor 쿼리를 `createSupabaseDonorClient()`(RLS 적용) 로 마이그레이션 고려 — 별도 스펙 |
| S2 | Action 배너에 "admin이 변경했다" 노출 자체는 감사 이벤트로 기록되지 않음 | 민감정보 조회는 아니므로 현재 감사 정책 범위 외 | YAGNI |

### 6.5 배포/운영 GAP

| # | GAP | 영향 | 대응 시점 |
|---|---|---|---|
| O1 | Spec A → Spec B 순서 전제. A 롤백 시 B만 남으면 `--warning-soft` 등 Spec A 추가 토큰을 B의 배너가 참조하는 불일치 발생 가능 | 시각 회귀 | 배포 가이드 — "A 완료 확인 후 B 진행, 롤백 시 B부터" |
| O2 | `cheer_messages.member_id` 가 "받는 사람"이 아니라 "작성자" 라는 **스키마-설계 괴리**를 본 스펙에서 발견하여 Action #4 제거함. 향후 "내게 달린 응원" 기능을 원한다면 스키마 확장 필요 | 제품 의도에 따라 후속 필요 | 후속 — `cheer_messages.recipient_member_id` 추가 또는 별도 "개인 알림" 스키마 |

### 6.6 본 스펙의 명시적 범위 외

- **Phase 7-D-2-b 환불 처리** — 별도 후속 스펙(PG 기간 내 전체/부분 취소)
- **모바일 bottom nav + 햄버거**
- **Action dismiss + 최근 1건 미리보기**
- **cheer 수신자 개념 신설** (스키마 확장)
- **기관별 테마 커스터마이즈** (Spec A 범위 외)
- **Action 종류 확장** (초대 보상, 알림 미설정, 임팩트 뱃지 등)

---

## 7. 체크리스트 (구현 시)

- [ ] `dashboard-actions.ts` 모든 쿼리에 `.eq('org_id', orgId).eq('member_id', memberId)` 필수 (S1 대응)
- [ ] `upcoming-payments.ts` 의 "이미 paid 된 promise 제외" + "지난 날짜 미납 제외" 두 조건 테스트로 명시
- [ ] `DonorNav` 드롭다운에 `role="menu"`, `aria-expanded`, `Escape` 핸들러
- [ ] `ActionRequiredBanner` 모든 카운트 0일 때 `return null`
- [ ] `UpcomingPaymentsCard` 빈 배열일 때 `return null`
- [ ] 라이트/다크 양쪽에서 배너 대비 검증 (체크 #17, #18)
- [ ] `/donor/promises` 페이지에서 네비 active 스타일 검증 (체크 #14)
