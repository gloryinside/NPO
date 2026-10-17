import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 회원 등급 자동 분류 정책.
 *
 * 누적 후원금 기준 (paid 상태의 payments.amount 합계):
 *   - bronze:    0 ~ 99,999원 (기본값)
 *   - silver:    100,000 ~ 499,999원
 *   - gold:      500,000 ~ 2,999,999원
 *   - platinum:  3,000,000 ~ 9,999,999원
 *   - diamond:   10,000,000원 이상
 *
 * tier_overridden=true 인 회원은 cron이 덮어쓰지 않는다 (수동 지정 보존).
 */
export type MemberTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';

const TIER_THRESHOLDS: Array<{ min: number; tier: MemberTier }> = [
  { min: 10_000_000, tier: 'diamond' },
  { min: 3_000_000, tier: 'platinum' },
  { min: 500_000, tier: 'gold' },
  { min: 100_000, tier: 'silver' },
  { min: 0, tier: 'bronze' },
];

export function computeTier(totalPaid: number): MemberTier {
  for (const { min, tier } of TIER_THRESHOLDS) {
    if (totalPaid >= min) return tier;
  }
  return 'bronze';
}

export const TIER_LABELS: Record<MemberTier, string> = {
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  platinum: '플래티넘',
  diamond: '다이아몬드',
};

export const TIER_COLORS: Record<MemberTier, string> = {
  bronze: '#a16207',
  silver: '#94a3b8',
  gold: '#eab308',
  platinum: '#0891b2',
  diamond: '#009944',
};

/**
 * 한 org의 모든 회원 tier를 재계산해 갱신한다.
 * tier_overridden=true 인 회원은 건드리지 않는다.
 */
export async function recomputeOrgTiers(
  supabase: SupabaseClient,
  orgId: string,
): Promise<{ updated: number; skipped: number }> {
  // 1) 회원별 paid 누적 합계 조회 (members 기준)
  const { data: members, error: mErr } = await supabase
    .from('members')
    .select('id, tier, tier_overridden')
    .eq('org_id', orgId);

  if (mErr || !members) return { updated: 0, skipped: 0 };

  // 2) paid payments 합계
  const { data: sums, error: sErr } = await supabase
    .from('payments')
    .select('member_id, amount')
    .eq('org_id', orgId)
    .eq('pay_status', 'paid');

  if (sErr) return { updated: 0, skipped: 0 };

  const totals = new Map<string, number>();
  for (const r of (sums ?? []) as Array<{ member_id: string | null; amount: number | null }>) {
    if (!r.member_id) continue;
    totals.set(r.member_id, (totals.get(r.member_id) ?? 0) + Number(r.amount ?? 0));
  }

  let updated = 0;
  let skipped = 0;
  const nowIso = new Date().toISOString();

  for (const m of members as Array<{ id: string; tier: string | null; tier_overridden: boolean | null }>) {
    if (m.tier_overridden) { skipped++; continue; }
    const newTier = computeTier(totals.get(m.id) ?? 0);
    if (newTier === m.tier) continue;

    const { error: upErr } = await supabase
      .from('members')
      .update({ tier: newTier, tier_updated_at: nowIso })
      .eq('id', m.id);
    if (!upErr) updated++;
  }

  return { updated, skipped };
}
