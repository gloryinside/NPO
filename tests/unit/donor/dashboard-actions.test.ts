import { describe, it, expect, vi } from 'vitest';
import { getDashboardActions } from '@/lib/donor/dashboard-actions';

function makeBuilder(count: number | null, error: unknown = null) {
  const result = { count, error, data: null };
  const chainProxy: Record<string, unknown> = {};
  const target: Record<string, unknown> = chainProxy;
  return new Proxy(target, {
    get(_t, prop) {
      if (prop === 'then') {
        return (resolve: (v: typeof result) => void) => {
          resolve(result);
          return Promise.resolve(result);
        };
      }
      return () =>
        new Proxy(chainProxy, {
          get(_t2, prop2) {
            if (prop2 === 'then') {
              return (resolve: (v: typeof result) => void) => {
                resolve(result);
                return Promise.resolve(result);
              };
            }
            // recursive for any subsequent chain call
            return () => new Proxy(chainProxy, this as ProxyHandler<object>);
          },
        });
    },
  });
}

function makeSupabase(
  responses: Array<{ count: number | null; error?: unknown }>,
) {
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

  it('queries 3 different tables (payments x2 + promise_amount_changes)', async () => {
    const sb = makeSupabase([{ count: 0 }, { count: 0 }, { count: 0 }]);
    await getDashboardActions(sb, 'o1', 'm1');
    const fromMock = (sb as unknown as { from: ReturnType<typeof vi.fn> }).from;
    expect(fromMock).toHaveBeenCalledTimes(3);
    const tableNames = fromMock.mock.calls.map((c) => c[0]);
    expect(tableNames.filter((n) => n === 'payments')).toHaveLength(2);
    expect(tableNames.filter((n) => n === 'promise_amount_changes')).toHaveLength(1);
  });
});
