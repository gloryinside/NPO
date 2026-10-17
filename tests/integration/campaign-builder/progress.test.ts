import { describe, it, expect, afterAll } from 'vitest';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

describe('getCampaignProgress', () => {
  const slugs: string[] = [];
  const paymentCodes: string[] = [];
  let createdMemberId: string | null = null;

  // 테스트가 만든 결제·회원까지 지운다(예전엔 기존 회원에게 붙인 결제가 매 실행마다 쌓였다)
  afterAll(async () => {
    const sb = createSupabaseAdminClient();
    if (paymentCodes.length) await sb.from('payments').delete().in('payment_code', paymentCodes);
    if (createdMemberId) await sb.from('members').delete().eq('id', createdMemberId);
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
      createdMemberId = newMember?.id ?? null;
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
    const stamp = Date.now();
    paymentCodes.push(`pc-a-${stamp}`, `pc-b-${stamp}`, `pc-c-${stamp}`);
    await sb.from('payments').insert([
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 30000,
        pay_status: 'paid',
        pay_date: now,
        payment_code: `pc-a-${stamp}`,
      },
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 20000,
        pay_status: 'paid',
        pay_date: now,
        payment_code: `pc-b-${stamp}`,
      },
      {
        campaign_id: c!.id,
        org_id: org!.id,
        member_id: member!.id,
        amount: 99999,
        pay_status: 'failed',
        pay_date: now,
        payment_code: `pc-c-${stamp}`,
      },
    ]);

    const p = await getCampaignProgress(slug);
    expect(p.raised).toBe(50000);
    expect(p.percent).toBe(50);
  });
});
