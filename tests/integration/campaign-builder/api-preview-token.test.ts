import { describe, it, expect, afterAll } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/preview-token/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.from('campaigns').delete().in('id', createdIds);
});

describe('preview-token', () => {
  it('generates token', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const res = await POST(
      await buildAuthedRequest('POST', ``, {}),
      { params: Promise.resolve({ id }) } as any,
    );
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  });

  it('rotates token on second call', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const r1 = await POST(
      await buildAuthedRequest('POST', ``, {}),
      { params: Promise.resolve({ id }) } as any,
    );
    const r2 = await POST(
      await buildAuthedRequest('POST', ``, {}),
      { params: Promise.resolve({ id }) } as any,
    );
    expect((await r1.json()).token).not.toBe((await r2.json()).token);
  });
});
