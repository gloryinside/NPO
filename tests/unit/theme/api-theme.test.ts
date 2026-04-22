import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({ getDonorSession: vi.fn() }));
vi.mock('@/lib/supabase/admin', () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));

import { POST } from '@/app/api/donor/theme/route';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

function buildReq(body: unknown): Request {
  return new Request('http://localhost/api/donor/theme', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSupabaseUpdateOk() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
  return { from, update, eq };
}

beforeEach(() => {
  vi.resetAllMocks();
  (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    allowed: true, remaining: 9, retryAfterMs: 0,
  });
});

describe('POST /api/donor/theme', () => {
  it('returns 401 when no session', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid preference value', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({ preference: 'purple' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing preference field', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });

  it('returns 204 with Set-Cookie header on success (light)', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(204);
    expect(res.headers.get('Set-Cookie')).toMatch(/npo_theme=light/);
  });

  it('accepts all 3 valid values', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    for (const v of ['light', 'dark', 'system']) {
      mockSupabaseUpdateOk();
      const res = await POST(buildReq({ preference: v }));
      expect(res.status).toBe(204);
    }
  });

  it('returns 429 when rate limit exceeded', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    mockSupabaseUpdateOk();
    (rateLimit as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: false, remaining: 0, retryAfterMs: 30_000,
    });
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(429);
  });

  it('returns 400 for malformed JSON', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    const req = new Request('http://localhost/api/donor/theme', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 500 when DB update fails', async () => {
    (getDonorSession as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      member: { id: 'm1', org_id: 'o1' },
    });
    const eq = vi.fn().mockResolvedValue({ error: { message: 'db down' } });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    (createSupabaseAdminClient as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ from });
    const res = await POST(buildReq({ preference: 'light' }));
    expect(res.status).toBe(500);
  });
});
