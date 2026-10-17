import { cronAuthError } from "@/lib/cron/runner";
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { issueAnnualReceipts } from '@/lib/receipt/annual-batch';

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

  const supabase = createSupabaseAdminClient();
  // 활성 기관만(정지·해지 기관 제외)
  const { data: orgs } = await supabase.from('orgs').select('id').eq('status', 'active');

  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const previousYear = nowKst.getUTCFullYear() - 1;

  let totalIssued = 0, totalSkipped = 0, totalFailed = 0;
  const blockedOrgs: string[] = [];

  for (const org of orgs ?? []) {
    const result = await issueAnnualReceipts(org.id as string, previousYear);
    totalIssued += result.issued;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
    if (result.blocked) blockedOrgs.push(org.id as string);
  }

  console.log(`[cron/issue-annual-receipts] year=${previousYear} issued=${totalIssued} skipped=${totalSkipped} failed=${totalFailed}`);
  return NextResponse.json({ year: previousYear, issued: totalIssued, skipped: totalSkipped, failed: totalFailed, blockedOrgs });
}
