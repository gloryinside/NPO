import { describe, it, expect, afterAll } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/publish/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.from('campaigns').delete().in('id', createdIds);
});

describe('POST publish', () => {
  it('publishes campaign', async () => {
    const { id } = await createTestCampaign({
      page_content: {
        meta: { schemaVersion: 1 },
        blocks: [{ id: '1', type: 'richText', props: { html: '<p>hi</p>' } }],
      },
    });
    createdIds.push(id);
    const res = await POST(
      await buildAuthedRequest('POST', `/api/admin/campaigns/${id}/publish`, {}),
      { params: Promise.resolve({ id }) } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('rejects campaign with invalid page_content', async () => {
    const { id } = await createTestCampaign({
      page_content: { meta: {}, blocks: [] },
    });
    createdIds.push(id);
    const res = await POST(
      await buildAuthedRequest('POST', `/api/admin/campaigns/${id}/publish`, {}),
      { params: Promise.resolve({ id }) } as any,
    );
    expect(res.status).toBe(422);
  });
});
