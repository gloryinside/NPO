import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { issueAnnualReceipts } from '@/lib/receipt/annual-batch';

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
  const { data: orgs } = await supabase.from('orgs').select('id');

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const previousYear = nowKst.getUTCFullYear() - 1;

  let totalIssued = 0, totalSkipped = 0, totalFailed = 0;

  for (const org of orgs ?? []) {
    const result = await issueAnnualReceipts(org.id as string, previousYear);
    totalIssued += result.issued;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log(`[cron/issue-annual-receipts] year=${previousYear} issued=${totalIssued} skipped=${totalSkipped} failed=${totalFailed}`);
  return NextResponse.json({ year: previousYear, issued: totalIssued, skipped: totalSkipped, failed: totalFailed });
}
