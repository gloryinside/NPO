import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { processRetries } from '@/lib/billing/retry-service';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET is required in production' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: orgs } = await supabase.from('orgs').select('id');

  let totalRetried = 0;
  let totalSuspended = 0;

  for (const org of orgs ?? []) {
    const result = await processRetries(org.id as string);
    totalRetried += result.retried;
    totalSuspended += result.suspended;
  }

  console.log(`[cron/retry-billing] retried=${totalRetried} suspended=${totalSuspended}`);
  return NextResponse.json({ retried: totalRetried, suspended: totalSuspended });
}
