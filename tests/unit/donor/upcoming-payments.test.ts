import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { getUpcomingPaymentsThisMonth } from '@/lib/donor/upcoming-payments';

type PromiseRow = {
  id: string;
  campaign_id: string | null;
  amount: number;
  pay_day: number;
  campaigns: { title: string } | null;
};

type Response = { data: unknown; error: unknown };

function chain(response: Response): unknown {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: Response) => void) => {
          resolve(response);
          return Promise.resolve(response);
        };
      }
      return () => chain(response);
    },
  });
}

function makeSupabase(
  promises: Array<PromiseRow>,
  paidPromiseIds: Array<string>,
) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'promises') {
        return chain({ data: promises, error: null });
      }
      if (table === 'payments') {
        return chain({
          data: paidPromiseIds.map((pid) => ({ promise_id: pid })),
          error: null,
        });
      }
      return chain({ data: [], error: null });
    }),
  } as unknown as Parameters<typeof getUpcomingPaymentsThisMonth>[0];
}

describe('getUpcomingPaymentsThisMonth', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00Z')); // 4월 15일 UTC
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
      ['p1'],
    );
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toHaveLength(0);
  });

  it('excludes past pay_days (overlap with Action #1 prevention)', async () => {
    const sb = makeSupabase(
      [
        {
          id: 'p1',
          campaign_id: 'c1',
          amount: 30000,
          pay_day: 5, // 오늘=15일 이전
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
    expect(out.map((p) => p.scheduledDate)).toEqual([
      '2026-04-20',
      '2026-04-28',
    ]);
  });

  it('returns empty array on promises query error', async () => {
    const sb = {
      from: vi.fn((_: string) =>
        chain({ data: null, error: { message: 'db down' } }),
      ),
    } as unknown as Parameters<typeof getUpcomingPaymentsThisMonth>[0];
    const out = await getUpcomingPaymentsThisMonth(sb, 'o1', 'm1');
    expect(out).toEqual([]);
  });
});
