import { cronAuthError } from "@/lib/cron/runner";
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { processRetries } from '@/lib/billing/retry-service';

export async function GET(req: NextRequest) {
  const authError = cronAuthError(req);
  if (authError) return authError;

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
