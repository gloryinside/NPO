import { describe, it, expect, afterAll } from 'vitest';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

describe('getCampaignProgress', () => {
  const slugs: string[] = [];

  afterAll(async () => {
    const sb = createSupabaseAdminClient();
    for (const s of slugs) {
      await sb.from('campaigns').delete().eq('slug', s);
    }
  });

  it('sums paid payments and returns percent', async () => {
    const sb = createSupabaseAdminClient();
    const { data: org } = await sb.from('orgs').select('id').limit(1).single();
    let { data: member } = await sb
      .from('members')
      .select('id')
      .eq('org_id', org!.id)
      .limit(1)
      .maybeSingle();

    if (!member) {
      const { data: newMember } = await sb
        .from('members')
        .insert({ org_id: org!.id, name: 'Test Member', member_code: `MC-${Date.now()}`, email: `test-${Date.now()}@example.com` })
        .select('id')
        .single();
      member = newMember;
    }

    const slug = `prog-${Date.now()}`;
    slugs.push(slug);
    const { data: c } = await sb
      .from('campaigns')
      .insert({
        title: 'P',
        slug,
        org_id: org!.id,
        donation_type: 'onetime',
        goal_amount: 100000,
      })
      .select()
      .single();

    const now = new Date().toISOString().slice(0, 10); // date only for pay_date
    await sb.from('payments').insert([
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 30000,
        pay_status: 'paid',
        pay_date: now,
        payment_code: `pc-a-${Date.now()}`,
      },
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 20000,
        pay_status: 'paid',
        pay_date: now,
        payment_code: `pc-b-${Date.now()}`,
      },
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 99999,
        pay_status: 'failed',
        pay_date: now,
        payment_code: `pc-c-${Date.now()}`,
      },
    ]);

    const p = await getCampaignProgress(slug);
    expect(p.raised).toBe(50000);
    expect(p.percent).toBe(50);
  });
});
