import { describe, it, expect, afterAll } from 'vitest';
import { PATCH } from '@/app/api/admin/campaigns/[id]/form-settings/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.from('campaigns').delete().in('id', createdIds);
});

describe('PATCH form-settings', () => {
  it('saves valid form settings', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const res = await PATCH(
      await buildAuthedRequest(
        'PATCH',
        `/api/admin/campaigns/${id}/form-settings`,
        defaultFormSettings(),
      ),
      { params: Promise.resolve({ id }) } as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('rejects invalid payment method', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);
    const res = await PATCH(
      await buildAuthedRequest(
        'PATCH',
        `/api/admin/campaigns/${id}/form-settings`,
        { ...defaultFormSettings(), paymentMethods: ['bitcoin'] },
      ),
      { params: Promise.resolve({ id }) } as any,
    );
    expect(res.status).toBe(400);
  });
});
