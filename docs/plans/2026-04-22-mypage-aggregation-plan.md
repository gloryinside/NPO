# Phase 7-D-3 MyPage 집약 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** donor 영역을 집약형 MyPage 로 재구성. 평면 탭 8개를 드롭다운([홈][후원▾][참여▾][설정])으로 축약하고, 홈 대시보드에 Action Required 배너(3종) + "이번 달 예정 납입" 카드 추가.

**Architecture:** 2개 신규 lib(`dashboard-actions`, `upcoming-payments`) 가 기존 `payments` / `promises` / `promise_amount_changes` 테이블을 병렬 조회. 3개 신규 컴포넌트(`DonorNav` 리뉴얼 + `ActionRequiredBanner` + `UpcomingPaymentsCard`). DB 마이그레이션 없음.

**Tech Stack:** Next.js 16 App Router, React 19, Supabase, vitest, lucide-react.

---

## 파일 구조

**Create:**

- `src/lib/donor/dashboard-actions.ts` — Action Required 3종 카운트
- `src/lib/donor/upcoming-payments.ts` — 이번 달 예정 납입 계산
- `src/components/donor/dashboard/action-required-banner.tsx`
- `src/components/donor/dashboard/upcoming-payments-card.tsx`
- `tests/unit/donor/dashboard-actions.test.ts`
- `tests/unit/donor/upcoming-payments.test.ts`

**Modify:**

- `src/components/donor/donor-nav.tsx` — 평면 탭 → 드롭다운 그룹
- `src/app/(donor)/donor/page.tsx` — 홈에 배너/카드 섹션 추가

---

## Task 1: dashboard-actions.ts + 테스트

**Files:**

- Create: `src/lib/donor/dashboard-actions.ts`
- Create: `tests/unit/donor/dashboard-actions.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/donor/dashboard-actions.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getDashboardActions } from '@/lib/donor/dashboard-actions';

function makeBuilder(count: number | null, error: unknown = null) {
  const finalThenable = {
    then: (resolve: (v: { count: number | null; error: unknown }) => void) => {
      resolve({ count, error });
      return finalThenable;
    },
  };
  const chainProxy: Record<string, unknown> = {};
  const mk = (): unknown =>
    new Proxy(chainProxy, {
      get(_t, prop) {
        if (prop === 'then') return finalThenable.then;
        return () => mk();
      },
    });
  return mk();
}

function makeSupabase(responses: Array<{ count: number | null; error?: unknown }>) {
  let call = 0;
  return {
    from: vi.fn(() => {
      const r = responses[call++] ?? { count: 0 };
      return makeBuilder(r.count ?? 0, r.error ?? null);
    }),
  } as unknown as Parameters<typeof getDashboardActions>[0];
}

describe('getDashboardActions', () => {
  it('returns all 3 counts from parallel queries', async () => {
    const sb = makeSupabase([
      { count: 2 }, // failedPayments
      { count: 1 }, // missingRrnReceipts
      { count: 3 }, // recentAdminChanges
    ]);
    const out = await getDashboardActions(sb, 'o1', 'm1');
    expect(out.failedPayments).toBe(2);
    expect(out.missingRrnReceipts).toBe(1);
    expect(out.recentAdminChanges).toBe(3);
  });

  it('falls back to 0 on individual query error (isolated failures)', async () => {
    const sb = makeSupabase([
      { count: 2 },
      { count: null, error: { message: 'db' } },
      { count: 3 },
    ]);
    const out = await getDashboardActions(sb, 'o1', 'm1');
    expect(out.failedPayments).toBe(2);
    expect(out.missingRrnReceipts).toBe(0);
    expect(out.recentAdminChanges).toBe(3);
  });

  it('returns 0s when all counts are null', async () => {
    const sb = makeSupabase([
      { count: null },
      { count: null },
      { count: null },
    ]);
    const out = await getDashboardActions(sb, 'o1', 'm1');
    expect(out).toEqual({
      failedPayments: 0,
      missingRrnReceipts: 0,
      recentAdminChanges: 0,
    });
  });

  it('queries 3 different tables', async () => {
    const sb = makeSupabase([{ count: 0 }, { count: 0 }, { count: 0 }]);
    await getDashboardActions(sb, 'o1', 'm1');
    const fromMock = (sb as unknown as { from: ReturnType<typeof vi.fn> }).from;
    expect(fromMock).toHaveBeenCalledTimes(3);
    expect(fromMock.mock.calls.map((c) => c[0])).toEqual(
      expect.arrayContaining(['payments', 'payments', 'promise_amount_changes']),
    );
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/unit/donor/dashboard-actions.test.ts`
Expected: FAIL — `Cannot find module '@/lib/donor/dashboard-actions'`

- [ ] **Step 3: 구현**

`src/lib/donor/dashboard-actions.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DashboardActions {
  failedPayments: number;
  missingRrnReceipts: number;
  recentAdminChanges: number;
}

export async function getDashboardActions(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<DashboardActions> {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const yearStart = `${currentYear}-01-01`;
  const yearEnd = `${currentYear + 1}-01-01`;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400_000).toISOString();

  const failedQ = supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'failed')
    .lt('retry_count', 3);

  const rrnQ = supabase
    .from('payments')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .eq('receipt_opt_in', true)
    .is('rrn_pending_encrypted', null)
    .is('receipt_id', null)
    .gte('pay_date', yearStart)
    .lt('pay_date', yearEnd);

  const changesQ = supabase
    .from('promise_amount_changes')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('actor', 'admin')
    .gte('created_at', thirtyDaysAgo);

  const [failed, rrn, changes] = await Promise.all([failedQ, rrnQ, changesQ]);

  return {
    failedPayments: failed.error ? 0 : failed.count ?? 0,
    missingRrnReceipts: rrn.error ? 0 : rrn.count ?? 0,
    recentAdminChanges: changes.error ? 0 : changes.count ?? 0,
  };
}
```

- [ ] **Step 4: PASS 확인**

Run: `npm test -- tests/unit/donor/dashboard-actions.test.ts`
Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donor/dashboard-actions.ts tests/unit/donor/dashboard-actions.test.ts
git commit -m "feat(donor): dashboard-actions lib — Action Required 3종 카운트

getDashboardActions(supabase, orgId, memberId):
- failedPayments: pay_status='failed' AND retry_count<3
- missingRrnReceipts: 올해 paid + receipt_opt_in + rrn/receipt null
- recentAdminChanges: promise_amount_changes actor='admin' 30일 내

Promise.all 병렬 조회, 개별 쿼리 에러 시 해당 항목만 0 폴백.
count+head 조회로 행 페치 없이 카운트만.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: upcoming-payments.ts + 테스트

**Files:**

- Create: `src/lib/donor/upcoming-payments.ts`
- Create: `tests/unit/donor/upcoming-payments.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/donor/upcoming-payments.test.ts`:

```ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getUpcomingPaymentsThisMonth } from '@/lib/donor/upcoming-payments';

type Promise_ = {
  id: string;
  campaign_id: string | null;
  amount: number;
  pay_day: number;
  campaigns: { title: string } | null;
};

function makeSupabase(
  promises: Array<Promise_>,
  paidPromiseIds: Array<string>,
) {
  const tables: Record<string, unknown> = {
    promises: {
      data: promises,
      error: null,
    },
    payments: {
      data: paidPromiseIds.map((pid) => ({ promise_id: pid })),
      error: null,
    },
  };

  function chain(data: unknown, error: unknown): unknown {
    const target: Record<string, unknown> = {};
    return new Proxy(target, {
      get(_t, prop) {
        if (prop === 'then') {
          return (resolve: (v: { data: unknown; error: unknown }) => void) => {
            resolve({ data, error });
            return chain(data, error);
          };
        }
        return () => chain(data, error);
      },
    });
  }

  return {
    from: vi.fn((table: string) => {
      const t = tables[table] as { data: unknown; error: unknown };
      return chain(t.data, t.error);
    }),
  } as unknown as Parameters<typeof getUpcomingPaymentsThisMonth>[0];
}

describe('getUpcomingPaymentsThisMonth', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00Z')); // 4월 15일
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  it('returns upcoming payments for future pay_days this month', async () => {
    const sb = makeSupabase(
      [
        {
          id: 'p1',
          campaign_id: 'c1',
          amount: 30000,
          pay_day: 25,
          campaigns: { title: '캠페인1' },
        },
      ],
      [],
    );
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      promiseId: 'p1',
      amount: 30000,
      scheduledDate: '2026-04-25',
      campaignTitle: '캠페인1',
    });
  });

  it('excludes promises already paid this month', async () => {
    const sb = makeSupabase(
      [
        {
          id: 'p1',
          campaign_id: 'c1',
          amount: 30000,
          pay_day: 25,
          campaigns: { title: '캠페인1' },
        },
      ],
      ['p1'], // 이미 paid
    );
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toHaveLength(0);
  });

  it('excludes past pay_days (to avoid overlap with Action #1 failed payments)', async () => {
    const sb = makeSupabase(
      [
        {
          id: 'p1',
          campaign_id: 'c1',
          amount: 30000,
          pay_day: 5, // 이미 지남 (오늘=15일)
          campaigns: { title: '캠페인1' },
        },
      ],
      [],
    );
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toHaveLength(0);
  });

  it('sorts ascending by scheduledDate', async () => {
    const sb = makeSupabase(
      [
        { id: 'p1', campaign_id: null, amount: 1000, pay_day: 28, campaigns: null },
        { id: 'p2', campaign_id: null, amount: 2000, pay_day: 20, campaigns: null },
      ],
      [],
    );
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out.map((p) => p.scheduledDate)).toEqual(['2026-04-20', '2026-04-28']);
  });

  it('returns empty array on DB error', async () => {
    const sb = {
      from: vi.fn(() => {
        const target: Record<string, unknown> = {};
        return new Proxy(target, {
          get(_t, prop) {
            if (prop === 'then') {
              return (resolve: (v: { data: unknown; error: unknown }) => void) => {
                resolve({ data: null, error: { message: 'db down' } });
              };
            }
            return () => new Proxy(target, this as ProxyHandler<object>);
          },
        });
      }),
    } as unknown as Parameters<typeof getUpcomingPaymentsThisMonth>[0];
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- tests/unit/donor/upcoming-payments.test.ts`
Expected: FAIL — `Cannot find module '@/lib/donor/upcoming-payments'`

- [ ] **Step 3: 구현**

`src/lib/donor/upcoming-payments.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

export interface UpcomingPayment {
  promiseId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  amount: number;
  scheduledDate: string; // YYYY-MM-DD
}

interface PromiseRow {
  id: string;
  campaign_id: string | null;
  amount: number;
  pay_day: number;
  campaigns: { title: string } | { title: string }[] | null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export async function getUpcomingPaymentsThisMonth(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<UpcomingPayment[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  const today = now.getUTCDate();
  const monthStart = `${year}-${pad2(month)}-01`;
  const nextMonthStart =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${pad2(month + 1)}-01`;

  const { data: promisesRaw, error: promisesErr } = await supabase
    .from('promises')
    .select('id, campaign_id, amount, pay_day, campaigns(title)')
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('type', 'regular')
    .eq('status', 'active')
    .not('pay_day', 'is', null);

  if (promisesErr || !promisesRaw) return [];

  const promises = promisesRaw as unknown as PromiseRow[];

  const { data: paidRaw, error: paidErr } = await supabase
    .from('payments')
    .select('promise_id')
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .gte('pay_date', monthStart)
    .lt('pay_date', nextMonthStart);

  if (paidErr) return [];

  const paidIds = new Set(
    ((paidRaw as Array<{ promise_id: string | null }>) ?? [])
      .map((r) => r.promise_id)
      .filter((x): x is string => Boolean(x)),
  );

  const upcoming: UpcomingPayment[] = [];
  for (const p of promises) {
    if (paidIds.has(p.id)) continue;
    if (p.pay_day < today) continue; // 이미 지남 → Action #1 이 처리
    const scheduledDate = `${year}-${pad2(month)}-${pad2(p.pay_day)}`;
    const title = Array.isArray(p.campaigns)
      ? p.campaigns[0]?.title ?? null
      : p.campaigns?.title ?? null;
    upcoming.push({
      promiseId: p.id,
      campaignId: p.campaign_id,
      campaignTitle: title,
      amount: p.amount,
      scheduledDate,
    });
  }

  upcoming.sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));
  return upcoming;
}
```

- [ ] **Step 4: PASS 확인**

Run: `npm test -- tests/unit/donor/upcoming-payments.test.ts`
Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/donor/upcoming-payments.ts tests/unit/donor/upcoming-payments.test.ts
git commit -m "feat(donor): upcoming-payments lib — 이번 달 예정 납입 계산

getUpcomingPaymentsThisMonth:
- type='regular' + status='active' + pay_day 있는 promise 조회
- 이번 달 이미 paid 된 promise 제외
- pay_day < today 미납 제외 (Action #1 '실패 자동결제'와 중복 방지)
- scheduledDate 오름차순 정렬

월 1회 납입 전제(스펙 §1.3). DB 에러 시 빈 배열 폴백.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: ActionRequiredBanner 컴포넌트

**Files:**

- Create: `src/components/donor/dashboard/action-required-banner.tsx`

- [ ] **Step 1: 구현**

`src/components/donor/dashboard/action-required-banner.tsx`:

```tsx
import { AlertCircle } from 'lucide-react';
import type { DashboardActions } from '@/lib/donor/dashboard-actions';

interface ActionRequiredBannerProps {
  actions: DashboardActions;
}

interface Item {
  label: string;
  linkLabel: string;
  href: string;
}

function buildItems(actions: DashboardActions): Item[] {
  const items: Item[] = [];
  if (actions.failedPayments > 0) {
    items.push({
      label: `결제 실패 (${actions.failedPayments}건) — 결제수단 확인이 필요합니다`,
      linkLabel: '납입내역 보기',
      href: '/donor/payments?status=failed',
    });
  }
  if (actions.missingRrnReceipts > 0) {
    items.push({
      label: `영수증 미발급 (${actions.missingRrnReceipts}건) — 연말정산 영수증 발급을 위해 주민번호 입력이 필요합니다`,
      linkLabel: '영수증 신청',
      href: '/donor/receipts',
    });
  }
  if (actions.recentAdminChanges > 0) {
    items.push({
      label: `약정 변경 이력 (${actions.recentAdminChanges}건) — 관리자가 최근 30일 내 약정 금액을 변경했습니다`,
      linkLabel: '약정 보기',
      href: '/donor/promises',
    });
  }
  return items;
}

export function ActionRequiredBanner({ actions }: ActionRequiredBannerProps) {
  const items = buildItems(actions);
  if (items.length === 0) return null;

  return (
    <section
      role="region"
      aria-labelledby="action-required-title"
      style={{
        background: 'var(--warning-soft)',
        border: '1px solid var(--warning)',
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
      }}
    >
      <h2
        id="action-required-title"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 15,
          fontWeight: 600,
          color: 'var(--warning)',
          margin: 0,
        }}
      >
        <AlertCircle size={18} />
        확인이 필요한 내역이 있습니다
      </h2>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '0.75rem 0 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {items.map((item, i) => (
          <li
            key={i}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '1rem',
              fontSize: 14,
              color: 'var(--text)',
            }}
          >
            <span>• {item.label}</span>
            <a
              href={item.href}
              style={{
                flexShrink: 0,
                color: 'var(--warning)',
                fontWeight: 500,
                textDecoration: 'none',
                fontSize: 13,
              }}
            >
              {item.linkLabel} →
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/donor/dashboard/action-required-banner.tsx
git commit -m "feat(donor): ActionRequiredBanner 컴포넌트

DashboardActions 3종 카운트 받아 > 0인 항목만 세로 리스트로 렌더.
모두 0이면 return null. 각 항목 <a href> 로 SSR 네비게이션. role=region,
AlertCircle 아이콘, --warning-soft/--warning 토큰으로 라이트/다크 적응.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: UpcomingPaymentsCard 컴포넌트

**Files:**

- Create: `src/components/donor/dashboard/upcoming-payments-card.tsx`

- [ ] **Step 1: 구현**

`src/components/donor/dashboard/upcoming-payments-card.tsx`:

```tsx
import type { UpcomingPayment } from '@/lib/donor/upcoming-payments';

interface UpcomingPaymentsCardProps {
  payments: UpcomingPayment[];
}

function formatKRW(n: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(n)}원`;
}

function formatMDay(isoDate: string): string {
  // '2026-04-25' → '4월 25일'
  const [, m, d] = isoDate.split('-');
  return `${parseInt(m, 10)}월 ${parseInt(d, 10)}일`;
}

export function UpcomingPaymentsCard({ payments }: UpcomingPaymentsCardProps) {
  if (payments.length === 0) return null;
  const subtotal = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <section>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--text)',
          margin: '0 0 0.75rem',
        }}
      >
        이번 달 예정 납입
      </h2>
      <div
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
        }}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {payments.map((p, i) => (
            <li
              key={p.promiseId}
              style={{
                display: 'grid',
                gridTemplateColumns: '88px 1fr auto',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                fontSize: 14,
              }}
            >
              <span style={{ color: 'var(--muted-foreground)' }}>
                {formatMDay(p.scheduledDate)}
              </span>
              <span style={{ color: 'var(--text)' }}>
                정기후원 {p.campaignTitle ? `(${p.campaignTitle})` : ''}
              </span>
              <span style={{ color: 'var(--text)', fontWeight: 500 }}>
                {formatKRW(p.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            padding: '0.75rem 1rem',
            borderTop: '1px solid var(--border)',
            background: 'var(--surface-2)',
            fontSize: 14,
            color: 'var(--text)',
          }}
        >
          <span style={{ color: 'var(--muted-foreground)', marginRight: 8 }}>
            소계:
          </span>
          <span style={{ fontWeight: 600 }}>{formatKRW(subtotal)}</span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/donor/dashboard/upcoming-payments-card.tsx
git commit -m "feat(donor): UpcomingPaymentsCard 컴포넌트

이번 달 예정 납입 리스트 + 소계. 빈 배열이면 return null.
일자는 'M월 D일' 한글 포맷, 금액은 ko-KR 로케일. --surface 카드
패턴 + --border / --surface-2 토큰.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: DonorNav 드롭다운 리뉴얼

**Files:**

- Modify: `src/components/donor/donor-nav.tsx` — 전체 교체

- [ ] **Step 1: 전체 교체**

`src/components/donor/donor-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    label: "후원",
    items: [
      { href: "/donor/promises", label: "약정" },
      { href: "/donor/payments", label: "납입내역" },
      { href: "/donor/receipts", label: "영수증" },
    ],
  },
  {
    label: "참여",
    items: [
      { href: "/donor/impact", label: "임팩트" },
      { href: "/donor/cheer", label: "응원" },
      { href: "/donor/invite", label: "초대" },
    ],
  },
];

const SINGLE_HOME: NavItem = { href: "/donor", label: "홈" };
const SINGLE_SETTINGS: NavItem = { href: "/donor/settings", label: "설정" };

function isActive(pathname: string, href: string): boolean {
  if (href === "/donor") return pathname === "/donor";
  return pathname.startsWith(href);
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    color: active ? "var(--accent)" : "var(--muted-foreground)",
    fontSize: 14,
    textDecoration: "none",
    fontWeight: active ? 500 : 400,
    borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
    paddingBottom: 2,
    transition: "color 0.15s",
    background: "none",
    border: "none",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 2,
  };
}

function DropdownGroup({ group }: { group: NavGroup }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const groupActive = group.items.some((it) => isActive(pathname, it.href));

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          ...tabStyle(groupActive),
          borderBottomColor: groupActive || open ? "var(--accent)" : "transparent",
        }}
      >
        {group.label}
        <ChevronDown
          size={12}
          style={{
            transition: "transform 0.15s",
            transform: open ? "rotate(180deg)" : "none",
          }}
        />
      </button>
      {open && (
        <div
          role="menu"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            boxShadow: "var(--shadow-card)",
            padding: 4,
            minWidth: 140,
            zIndex: 50,
          }}
        >
          {group.items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                style={{
                  display: "block",
                  padding: "0.5rem 0.75rem",
                  fontSize: 14,
                  color: active ? "var(--accent)" : "var(--text)",
                  background: active ? "var(--accent-soft)" : "transparent",
                  borderRadius: 4,
                  textDecoration: "none",
                  fontWeight: active ? 500 : 400,
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SingleTab({ item }: { item: NavItem }) {
  const pathname = usePathname();
  const active = isActive(pathname, item.href);
  return (
    <Link href={item.href} style={tabStyle(active)}>
      {item.label}
    </Link>
  );
}

export function DonorNav() {
  return (
    <nav
      style={{
        marginLeft: "1.5rem",
        display: "flex",
        gap: "1rem",
        alignItems: "center",
      }}
    >
      <SingleTab item={SINGLE_HOME} />
      {GROUPS.map((g) => (
        <DropdownGroup key={g.label} group={g} />
      ))}
      <SingleTab item={SINGLE_SETTINGS} />
    </nav>
  );
}
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors, build success.

- [ ] **Step 3: Commit**

```bash
git add src/components/donor/donor-nav.tsx
git commit -m "feat(donor): 네비를 드롭다운 그룹으로 리뉴얼

평면 탭 8개를 [홈][후원▾][참여▾][설정] 구조로 재편. 후원 그룹은
약정/납입내역/영수증, 참여는 임팩트/응원/초대, 설정은 단독.
그룹 탭 클릭 시 드롭다운 토글, 바깥 클릭/Escape 로 닫힘, ARIA
aria-haspopup/aria-expanded/role=menu. 하위 경로 active 시 그룹도
활성 스타일. --surface/--border/--shadow-card/--accent-soft 토큰.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: 홈 페이지에 섹션 추가

**Files:**

- Modify: `src/app/(donor)/donor/page.tsx`

- [ ] **Step 1: 기존 홈 페이지에 쿼리/섹션 추가**

import 섹션에 추가:

```tsx
import { getDashboardActions } from "@/lib/donor/dashboard-actions";
import { getUpcomingPaymentsThisMonth } from "@/lib/donor/upcoming-payments";
import { ActionRequiredBanner } from "@/components/donor/dashboard/action-required-banner";
import { UpcomingPaymentsCard } from "@/components/donor/dashboard/upcoming-payments-card";
```

기존 `paidSumData` 쿼리 블록 뒤에 다음 추가:

```tsx
const [actions, upcomingPayments] = await Promise.all([
  getDashboardActions(supabase, member.org_id, member.id),
  getUpcomingPaymentsThisMonth(supabase, member.org_id, member.id),
]);
```

반환 JSX 에서 요약 카드 2개 (`grid grid-cols-1 gap-4 sm:grid-cols-2`) 바로 **다음** 에 `<ActionRequiredBanner actions={actions} />` 삽입. 활성 약정 목록 블록(`activePromises.length > 0 && ...`) 바로 **다음** 에 `<UpcomingPaymentsCard payments={upcomingPayments} />` 삽입.

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(donor\)/donor/page.tsx
git commit -m "feat(donor): 홈에 Action Required 배너 + 이번 달 예정 납입 섹션

getDashboardActions + getUpcomingPaymentsThisMonth 를 기존 홈 쿼리에
병렬 추가. 요약 카드 아래 ActionRequiredBanner (조건부), 활성 약정
목록 뒤 UpcomingPaymentsCard (조건부) 배치.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: 전체 테스트 + 빌드 + QA

- [ ] **Step 1: Unit tests**

Run: `npm test -- --project unit`
Expected: 212 + 9(Task 1: 4, Task 2: 5) = 221 passing.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: 성공.

- [ ] **Step 4: 수동 QA (스펙 §4.3 체크리스트 18개)**

스펙 `docs/2026-04-22-mypage-aggregation-design.md` §4.3 표의 18개 시나리오를 브라우저에서 확인.

---

## 구현 완료 기준

- 모든 Task 1-7 체크박스 완료
- Unit 테스트 전체 PASS (기존 212 + 신규 9)
- `npm run build` 성공
- Spec §4.3 수동 QA 18개 확인
