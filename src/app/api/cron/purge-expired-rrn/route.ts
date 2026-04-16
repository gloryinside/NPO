import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/cron/purge-expired-rrn
 *
 * Nightly cron: nulls out resident_no_encrypted / business_no_encrypted on
 * receipts whose rrn_retention_expires_at has passed.
 *
 * Secured by CRON_SECRET env var (x-cron-secret header) so only Vercel's
 * cron infrastructure can call it. Consistent with /api/cron/process-payments.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
  } else {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'CRON_SECRET is required in production' },
        { status: 401 }
      );
    }
  }

  const sb = createSupabaseAdminClient();
  const { error } = await sb
    .from('receipts')
    .update({
      resident_no_encrypted: null,
      business_no_encrypted: null,
      rrn_retention_expires_at: null,
    })
    .lt('rrn_retention_expires_at', new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
