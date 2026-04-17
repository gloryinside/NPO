import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyBillingUpcoming } from '@/lib/notifications/send';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET required' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const threeDaysLater = new Date(nowKst.getTime() + 3 * 86400000);
  const targetDay = threeDaysLater.getUTCDate();
  const targetDateStr = threeDaysLater.toISOString().slice(0, 10);

  const { data: promises } = await supabase
    .from('promises')
    .select('id, org_id, member_id, amount, members!inner(name, phone), orgs!inner(name)')
    .eq('status', 'active')
    .eq('type', 'regular')
    .eq('pay_day', targetDay);

  let sent = 0;

  for (const promise of promises ?? []) {
    const member = promise.members as unknown as { name: string; phone: string | null };
    const org = promise.orgs as unknown as { name: string };

    notifyBillingUpcoming({
      phone: member?.phone ?? null,
      name: member?.name ?? '후원자',
      date: targetDateStr,
      amount: promise.amount as number,
      orgName: org?.name ?? '',
    });
    sent++;
  }

  console.log(`[cron/billing-reminder] targetDay=${targetDay} sent=${sent}`);
  return NextResponse.json({ targetDay, sent });
}
