import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 이번 달 정기 약정 예정 납입 계산. DB 저장 없이 서버에서 계산.
 *
 * 전제: 정기(regular) 약정 = 월 1회 납입 (promises.pay_day 단일 일자).
 * 제외 조건:
 *  - 이번 달 이미 paid 된 promise (중복 납입 표기 방지)
 *  - pay_day < today 인 미납 (Action #1 '실패 자동결제'에서 처리 → 중복 방지)
 */
export interface UpcomingPayment {
  promiseId: string;
  campaignId: string | null;
  campaignTitle: string | null;
  amount: number;
  scheduledDate: string; // YYYY-MM-DD
}

interface PromiseRow {
  id: string;
  campaign_id: string | null;
  amount: number;
  pay_day: number;
  campaigns: { title: string } | { title: string }[] | null;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export async function getUpcomingPaymentsThisMonth(
  supabase: SupabaseClient,
  orgId: string,
  memberId: string,
): Promise<UpcomingPayment[]> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12
  const today = now.getUTCDate();
  const monthStart = `${year}-${pad2(month)}-01`;
  const nextMonthStart =
    month === 12 ? `${year + 1}-01-01` : `${year}-${pad2(month + 1)}-01`;

  const { data: promisesRaw, error: promisesErr } = await supabase
    .from('promises')
    .select('id, campaign_id, amount, pay_day, campaigns(title)')
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('type', 'regular')
    .eq('status', 'active')
    .not('pay_day', 'is', null);

  if (promisesErr || !promisesRaw) return [];
  const promises = promisesRaw as unknown as PromiseRow[];

  const { data: paidRaw, error: paidErr } = await supabase
    .from('payments')
    .select('promise_id')
    .eq('org_id', orgId)
    .eq('member_id', memberId)
    .eq('pay_status', 'paid')
    .gte('pay_date', monthStart)
    .lt('pay_date', nextMonthStart);

  if (paidErr) return [];

  const paidIds = new Set(
    ((paidRaw as Array<{ promise_id: string | null }>) ?? [])
      .map((r) => r.promise_id)
      .filter((x): x is string => Boolean(x)),
  );

  const upcoming: UpcomingPayment[] = [];
  for (const p of promises) {
    if (paidIds.has(p.id)) continue;
    if (p.pay_day < today) continue;
    const scheduledDate = `${year}-${pad2(month)}-${pad2(p.pay_day)}`;
    const title = Array.isArray(p.campaigns)
      ? p.campaigns[0]?.title ?? null
      : p.campaigns?.title ?? null;
    upcoming.push({
      promiseId: p.id,
      campaignId: p.campaign_id,
      campaignTitle: title,
      amount: p.amount,
      scheduledDate,
    });
  }

  upcoming.sort((a, b) => (a.scheduledDate < b.scheduledDate ? -1 : 1));
  return upcoming;
}
