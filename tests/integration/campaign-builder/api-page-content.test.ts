import { describe, it, expect, afterAll } from 'vitest';
import { PATCH } from '@/app/api/admin/campaigns/[id]/page-content/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.from('campaigns').delete().in('id', createdIds);
});

describe('PATCH page-content', () => {
  it('saves valid page_content', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const body = {
      meta: { schemaVersion: 1 },
      blocks: [{ id: '1', type: 'richText', props: { html: '<p>ok</p>' } }],
    };
    const req = await buildAuthedRequest(
      'PATCH',
      `/api/admin/campaigns/${id}/page-content`,
      body,
    );
    const res = await PATCH(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('rejects invalid block type', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const req = await buildAuthedRequest(
      'PATCH',
      `/api/admin/campaigns/${id}/page-content`,
      {
        meta: { schemaVersion: 1 },
        blocks: [{ id: '1', type: 'unknown', props: {} }],
      },
    );
    const res = await PATCH(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(400);
  });
});
