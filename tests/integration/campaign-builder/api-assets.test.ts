import { describe, it, expect, afterAll } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/assets/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length === 0) return;
  const admin = createSupabaseAdminClient();
  await admin.from('campaigns').delete().in('id', createdIds);
});

describe('assets', () => {
  it('rejects pdf (unsupported mime type)', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);

    const pdf = new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], 't.pdf', {
      type: 'application/pdf',
    });

    // Build an authed request, then override the body with FormData
    const authedReq = await buildAuthedRequest(
      'POST',
      `/api/admin/campaigns/${id}/assets`,
      null,
    );
    const fd = new FormData();
    fd.append('file', pdf);

    // Reconstruct the request with FormData body (no Content-Type override —
    // the browser sets it with the boundary automatically)
    const formReq = new Request(authedReq.url, {
      method: 'POST',
      headers: { Authorization: authedReq.headers.get('Authorization') ?? '' },
      body: fd,
    });

    const res = await POST(formReq as any, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/mime/);
  });

  it('skips gracefully when bucket missing (jpeg upload)', async () => {
    const { id } = await createTestCampaign();
    createdIds.push(id);

    // 1x1 white JPEG bytes
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0xff, 0xd9,
    ]);
    const img = new File([jpegBytes], 'test.jpg', { type: 'image/jpeg' });

    const authedReq = await buildAuthedRequest(
      'POST',
      `/api/admin/campaigns/${id}/assets`,
      null,
    );
    const fd = new FormData();
    fd.append('file', img);

    const formReq = new Request(authedReq.url, {
      method: 'POST',
      headers: { Authorization: authedReq.headers.get('Authorization') ?? '' },
      body: fd,
    });

    const res = await POST(formReq as any, { params: Promise.resolve({ id }) } as any);

    // Either succeeds (201) or bucket-not-found (503) — both are acceptable
    expect([201, 503]).toContain(res.status);
  });
});
