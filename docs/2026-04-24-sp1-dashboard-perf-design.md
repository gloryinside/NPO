# SP-1: Dashboard 성능·관측 기반 (2026-04-24)

## 목적

`/donor` 대시보드의 Supabase 라운드트립 6 RTT → 2 RTT로 감소, Streaming SSR 도입, Web Vitals 외부 전송 구축. SP-2~6이 이 페이지에 섹션을 추가하므로 가장 먼저 바닥을 다진다.

---

## 현황 GAP

| # | 문제 | 위치 |
|---|------|------|
| F19a | 블록 A 4쿼리 직렬 (`promises`, `payments×2`, `receipts`) | `page.tsx:70-113` |
| F19b | `upcoming-payments.ts` 내부 순차 2쿼리 병렬화 미적용 | `upcoming-payments.ts:44,56` |
| F19c | 대시보드 집계 RPC 없음 — 블록 A를 DB 함수 1회로 통합 가능 | `supabase/migrations/` 없음 |
| F20 | `<Suspense>` 경계 없음 — 6 RTT 완료까지 TTFB 전체 블록 | `layout.tsx`, `page.tsx` |
| F21 | Web Vitals가 `console.log` stub — PostHog 실제 전송 미구현 | `src/lib/observability/report.ts:90` |

---

## 설계 결정

### F19: 쿼리 통합 전략

**채택: PostgreSQL RPC (`get_donor_dashboard_snapshot`)**

이유:
- 블록 A의 4쿼리(promises·payments 최근 5건·receipts·paid 합계)는 모두 동일한 `(org_id, member_id)` 스코프 → 단일 RPC로 1 RTT
- 블록 B의 `upcoming-payments.ts` 내부 2쿼리도 RPC에 포함
- `dashboard-actions.ts` 3쿼리(`failed count`, `rrn_pending count`, `amount_changes count`)는 집계 카운터이므로 RPC에 합산
- 최종: 세션 1 RTT + RPC 1 RTT = **2 RTT** (현재 6 RTT → 67% 감소)

```sql
-- supabase/migrations/20260424XXXXXX_fn_donor_dashboard.sql
CREATE OR REPLACE FUNCTION get_donor_dashboard_snapshot(
  p_org_id  uuid,
  p_member_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'active_promises',      (SELECT jsonb_agg(...) FROM promises WHERE ...),
    'recent_payments',      (SELECT jsonb_agg(...) FROM payments WHERE ... LIMIT 5),
    'latest_receipt',       (SELECT row_to_json(r) FROM receipts r WHERE ... LIMIT 1),
    'total_paid',           (SELECT COALESCE(SUM(amount),0) FROM payments WHERE pay_status='paid' ...),
    'upcoming_payments',    (SELECT jsonb_agg(...) FROM promises WHERE ... AND pay_day ... ),
    'expiring_cards',       (SELECT jsonb_agg(...) FROM promises WHERE card_expiry_year IS NOT NULL ...),
    'action_failed_count',  (SELECT COUNT(*) FROM payments WHERE pay_status='failed' AND retry_count<3 ...),
    'action_rrn_count',     (SELECT COUNT(*) FROM payments WHERE receipt_opt_in=true AND rrn_pending_encrypted IS NULL AND receipt_id IS NULL ...),
    'action_changes_count', (SELECT COUNT(*) FROM promise_amount_changes WHERE actor='admin' AND created_at > NOW()-INTERVAL '30 days' ...)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
```

RPC는 `SECURITY DEFINER`로 RLS bypass — `p_org_id + p_member_id` 필터가 보안 경계.
`page.tsx`에서 `supabase.rpc('get_donor_dashboard_snapshot', { p_org_id, p_member_id })` 단일 호출로 교체.

### F20: Streaming SSR 구조

```
layout.tsx
└── page.tsx (Server Component)
    ├── [즉시 렌더] HeroSection (세션 데이터만, RPC 불필요)
    ├── <Suspense fallback={<ActionBannerSkeleton />}>
    │     └── ActionRequiredBanner (RPC 결과)
    ├── <Suspense fallback={<CardSkeleton />}>
    │     └── ExpiringCardsAlert (RPC 결과)
    └── <Suspense fallback={<DashboardSkeleton />}>
          └── DashboardBody (나머지 전체 — 약정/납입/영수증)
```

- HeroSection(인사·이름)은 세션에서 바로 렌더, TTFB 체감 개선
- RPC 응답 후 3개 Suspense 경계 동시 언블록 (단일 fetch라 waterfall 없음)
- `DashboardSkeleton`: 3개 카드 shimmer + 리스트 2줄 shimmer

### F21: Web Vitals → PostHog 전송

현재 `src/lib/observability/report.ts:90`의 `reportEvent()`가 `console.log` stub.

변경:
1. `posthog-js` 설치 (`npm i posthog-js`)
2. `report.ts`의 `reportEvent()` 내부에 PostHog 클라이언트 전송 추가
3. 필터: `/donor/*` 세그먼트만 캡처, `metric.name`을 `$web_vital_*` 이벤트로 전송
4. 환경변수: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`

```typescript
// src/lib/observability/report.ts (수정)
import posthog from 'posthog-js'

export function reportEvent(metric: WebVitalsMetric) {
  if (process.env.NODE_ENV === 'production') {
    posthog.capture(`$web_vital_${metric.name.toLowerCase()}`, {
      value: metric.value,
      rating: metric.rating,
      path: window.location.pathname,
    })
  }
  // console.log 유지 (개발 환경)
  console.log('[observability]', metric)
}
```

---

## 데이터 계층

### 마이그레이션

1. `20260424XXXXXX_fn_donor_dashboard.sql` — `get_donor_dashboard_snapshot` RPC 신규
   - RLS: `SECURITY DEFINER`, 함수 내부 `p_org_id + p_member_id` 필터
   - Grant: `GRANT EXECUTE ON FUNCTION get_donor_dashboard_snapshot TO authenticated`
   - 테스트: `SELECT get_donor_dashboard_snapshot('org-uuid', 'member-uuid')` 검증

### 타입

```typescript
// src/types/dashboard.ts (신규)
export interface DonorDashboardSnapshot {
  active_promises: PromiseWithRelations[]
  recent_payments: PaymentWithRelations[]
  latest_receipt: { id: string; year: number; total_amount: number; pdf_url: string | null } | null
  total_paid: number
  upcoming_payments: UpcomingPayment[]
  expiring_cards: ExpiringCard[]
  action_failed_count: number
  action_rrn_count: number
  action_changes_count: number
}
```

---

## 컴포넌트 계층

### 신규

- `src/components/donor/dashboard/hero-section.tsx` — 세션 데이터만 받는 순수 표시 컴포넌트 (page.tsx에서 분리)
- `src/components/donor/dashboard/dashboard-skeleton.tsx` — Suspense fallback shimmer
- `src/components/donor/dashboard/action-banner-skeleton.tsx`
- `src/components/donor/dashboard/dashboard-body.tsx` — 약정·납입·영수증 섹션 묶음

### 수정

- `src/app/(donor)/donor/page.tsx` — RPC 단일 호출 + Suspense 경계 추가, 기존 7개 쿼리 제거
- `src/lib/donor/upcoming-payments.ts` — `Promise.all` 적용 (RPC 통합 후 이 파일은 RPC 내 SQL로 이관)
- `src/lib/observability/report.ts` — PostHog 전송 추가
- `src/app/api/observability/web-vitals/route.ts` — 서버 side 수신은 유지, 클라이언트 direct 전송과 병행

---

## 완료 기준

| 지표 | 목표 |
|------|------|
| Supabase 라운드트립 | 6 → 2 (세션 + RPC) |
| `/donor` TTFB p75 | 30% 감소 |
| LCP p75 | < 2.5s |
| Suspense 경계 | 3개 skeleton 확인 |
| PostHog 이벤트 | `$web_vital_lcp`, `$web_vital_cls`, `$web_vital_inp` 수신 확인 |

---

## 제외 (YAGNI)

- CDN 캐시 (Vercel Edge Cache) — RPC는 사용자별 개인 데이터라 캐시 부적합
- ISR — 동일 이유
- `/donor/*` 외 라우트 Web Vitals 수집 — SP-6 이후 확장

---

## 선행 조건

없음. 모든 SP 중 가장 먼저 착수.
