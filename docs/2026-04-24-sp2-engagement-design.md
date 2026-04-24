# SP-2: 관여·재참여 (Engagement) (2026-04-24)

## 목적

정기후원자가 "왜 계속 후원해야 하는지"를 상기하는 장치 추가. 스트릭·연간 리포트·캠페인 기여 시각화·D-N 카운트다운.

---

## 현황 GAP

| GAP | 내용 | 위치 |
| --- | ---- | ---- |
| G1 | 스트릭(연속 납입 월) 계산 로직 없음 | `src/lib/donor/impact.ts` |
| G2 | `/donor/impact/share` 전용 페이지 없음 | impact 라우트 |
| G3 | `campaign_id NOT NULL` — 일반 후원이 impact 도넛에서 처리 애매 | `payments` 테이블 |
| G4 | impact·promises·receipts 페이지 전체 한글 하드코딩 (→SP-6에서 처리) | 페이지 전체 |

기존 구현 (이미 완료, 재활용):

- OG 이미지: `/api/donor/impact/og/route.tsx` (1200×630 PNG, 이름 마스킹)
- 연간 PDF: `/api/donor/impact/pdf/route.ts`
- 임팩트 페이지: `/donor/impact/page.tsx` (424줄, 도넛/히트맵/막대/테이블 완비)

---

## 설계 결정

### A1: 연간 기부 리포트 아카이브

기존 `/donor/impact`가 **현재 연도** 데이터만 표시. 연도별 아카이브를 추가.

```text
/donor/impact           → 현재 연도 (기존 유지)
/donor/impact/[year]    → 연도별 아카이브 (신규)
```

- `[year]` 페이지는 기존 `impact/page.tsx` 로직을 `year` prop으로 파라미터화한 Server Component로 분리
- `getDonorImpact()` 함수가 `year` 파라미터를 지원하는지 구현 시 확인 — 미지원 시 파라미터 추가
- 연도 선택 드롭다운을 `/donor/impact` 상단에 추가 — 클릭 시 `/donor/impact/2024` 등으로 이동
- SNS 공유: OG 라우트에 `year` 쿼리파라미터 지원 여부 확인 후 추가

```typescript
// src/app/(donor)/donor/impact/[year]/page.tsx
export default async function ImpactYearPage({ params }: { params: { year: string } }) {
  const year = parseInt(params.year)
  // ... getDonorImpact(supabase, org_id, member_id, year) 호출
}
```

### A2: 연속 후원 스트릭 배지

**계산 방법**: `payments` 테이블에서 `pay_status='paid'`인 레코드를 `pay_date` 기준으로 월 집합 생성 → 현재 월부터 역순으로 연속된 월 수를 카운트.

```typescript
// src/lib/donor/impact.ts (추가)
export function calcStreak(paidDates: Date[]): number {
  const months = new Set(paidDates.map(d => `${d.getFullYear()}-${d.getMonth()}`))
  let streak = 0
  const now = new Date()
  let cur = new Date(now.getFullYear(), now.getMonth(), 1)
  while (months.has(`${cur.getFullYear()}-${cur.getMonth()}`)) {
    streak++
    cur.setMonth(cur.getMonth() - 1)
  }
  return streak
}
```

**표시**: 히어로 섹션 `StatPill` 4번째 항목으로 추가 ("🔥 12개월 연속"). 3개월 미만은 표시 생략(YAGNI).

**SP-1 RPC 연동**: `get_donor_dashboard_snapshot` RPC에 `streak` 필드 포함 (DB 내 계산으로 RTT 추가 없음).

```sql
'streak', (
  SELECT COUNT(*)
  FROM (
    SELECT generate_series(
      DATE_TRUNC('month', MIN(pay_date)),
      DATE_TRUNC('month', NOW()),
      '1 month'
    ) gs
    INTERSECT
    SELECT DATE_TRUNC('month', pay_date)
    FROM payments
    WHERE org_id = p_org_id AND member_id = p_member_id AND pay_status = 'paid'
  ) t
  -- 실제로는 연속 계산이 필요하여 PL/pgSQL 루프로 구현
)
```

### A3: 캠페인별 기여 시각화

기존 `/donor/impact`에 도넛 차트가 이미 구현됨 (`payments.campaign_id` 기반). **추가 작업 없음**.

G3 (`campaign_id NOT NULL`) 처리: `campaigns` 테이블에 `org_id`별 "일반후원" 더미 캠페인이 있는지 확인 후, 없으면 `campaign_id IS NULL` 허용 마이그레이션 추가. 단, 기존 데이터 무결성 확인 후 결정 — **SP-4 법무 트랙 이후로 연기, YAGNI**.

### A4: "다음 결제까지 D-N" 카운트다운

**SP-1 RPC의 `upcoming_payments` 데이터 재사용**. 가장 가까운 `pay_day` 기준 D-N 계산.

```typescript
// src/components/donor/dashboard/hero-section.tsx 내
function calcDaysUntilNext(upcomingPayments: UpcomingPayment[]): number | null {
  if (upcomingPayments.length === 0) return null
  const now = new Date()
  const nextDay = upcomingPayments[0].pay_day
  const nextDate = new Date(now.getFullYear(), now.getMonth(), nextDay)
  if (nextDate < now) nextDate.setMonth(nextDate.getMonth() + 1)
  return Math.ceil((nextDate.getTime() - now.getTime()) / 86400000)
}
```

히어로 섹션 StatPill 아래에 "💳 다음 결제 D-3" 형태로 표시. `null`이면 표시 안 함.

---

## 데이터 계층

### 마이그레이션

1. SP-1 RPC에 `streak` 필드 추가 (SP-1 마이그레이션에 포함)
2. `/donor/impact/[year]` 라우트는 기존 `getDonorImpact(year)` API 재사용, DB 변경 없음

### 타입 수정

```typescript
// src/types/dashboard.ts (SP-1에서 신규, SP-2에서 확장)
export interface DonorDashboardSnapshot {
  // ... SP-1 필드
  streak: number  // 추가
}
```

---

## 컴포넌트 계층

### 신규

- `src/app/(donor)/donor/impact/[year]/page.tsx` — 연도별 아카이브 Server Component
- `src/components/donor/impact/year-selector.tsx` — 연도 드롭다운 (Client Component)

### 수정

- `src/components/donor/dashboard/hero-section.tsx` — A2 스트릭 배지, A4 D-N 카운트다운 추가
- `src/app/(donor)/donor/impact/page.tsx` — year-selector 추가, `og:image` meta 태그 보강

---

## 완료 기준

| 항목 | 기준 |
| ---- | ---- |
| 연도별 아카이브 | `/donor/impact/2024` 렌더링 정상 |
| OG 공유 | SNS 미리보기 1200×630 이미지 정상 |
| 스트릭 배지 | 3개월 이상 시 히어로에 표시, 수치 정확도 검증 |
| D-N 카운트다운 | 당월 결제일 기준 정확 계산 |

---

## 제외 (YAGNI)

- 스트릭 "달성" 푸시 알림
- 리더보드 / 랭킹
- campaign_id NULL 허용 마이그레이션 (영향 범위 큼, 별도 결정)
- i18n 적용 (SP-6에서 처리)

---

## 선행 조건

SP-1 완료 권장 (streak를 RPC에 포함하기 위해).
