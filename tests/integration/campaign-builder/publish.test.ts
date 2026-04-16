import { describe, it, expect, afterAll } from 'vitest';
import { publishCampaign } from '@/lib/campaign-builder/publish';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

describe('publishCampaign', () => {
  const slugs: string[] = [];

  afterAll(async () => {
    const sb = createSupabaseAdminClient();
    for (const s of slugs) {
      await sb.from('campaigns').delete().eq('slug', s);
    }
  });

  it('copies page_content to published_content', async () => {
    const sb = createSupabaseAdminClient();
    const { data: org } = await sb.from('orgs').select('id').limit(1).single();
    const slug = `pub-test-${Date.now()}`;
    slugs.push(slug);
    const { data: c } = await sb
      .from('campaigns')
      .insert({
        title: 'T',
        slug,
        org_id: org!.id,
        donation_type: 'onetime',
        page_content: {
          meta: { schemaVersion: 1 },
          blocks: [{ id: '1', type: 'richText', props: { html: '<p>x</p>' } }],
        },
      })
      .select()
      .single();
    const res = await publishCampaign(c!.id);
    expect(res.ok).toBe(true);
    const { data: after } = await sb
      .from('campaigns')
      .select('*')
      .eq('id', c!.id)
      .single();
    expect(after!.published_content).toEqual(after!.page_content);
    expect(after!.published_at).not.toBeNull();
  });

  it('rejects invalid page_content', async () => {
    const sb = createSupabaseAdminClient();
    const { data: org } = await sb.from('orgs').select('id').limit(1).single();
    const slug = `pub-bad-${Date.now()}`;
    slugs.push(slug);
    const { data: c } = await sb
      .from('campaigns')
      .insert({
        title: 'Bad',
        slug,
        org_id: org!.id,
        donation_type: 'onetime',
        page_content: { meta: {}, blocks: [] },
      })
      .select()
      .single();
    expect((await publishCampaign(c!.id)).ok).toBe(false);
  });
});
