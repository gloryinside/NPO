import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export type CampaignProgress = {
  raised: number;
  donorCount: number;
  goal: number;
  percent: number;
  endDate: string | null;
};

export async function getCampaignProgress(slug: string): Promise<CampaignProgress> {
  const sb = createSupabaseAdminClient();

  const { data: c } = await sb
    .from('campaigns')
    .select('id, goal_amount, ended_at')
    .eq('slug', slug)
    .single();

  if (!c) {
    return { raised: 0, donorCount: 0, goal: 0, percent: 0, endDate: null };
  }

  const { data: payments } = await sb
    .from('payments')
    .select('amount, member_id')
    .eq('campaign_id', c.id)
    .eq('pay_status', 'paid');

  const raised = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const donorCount = new Set((payments ?? []).map(p => p.member_id ?? '')).size;
  const goal = c.goal_amount ?? 0;
  const percent = goal > 0 ? Math.min(100, Math.floor((raised / goal) * 100)) : 0;

  return { raised, donorCount, goal, percent, endDate: c.ended_at ?? null };
}
