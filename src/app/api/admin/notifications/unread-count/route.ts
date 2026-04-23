import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const tenantId = guard.ctx.tenant.id;

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', tenantId)
    .eq('read', false);

  return NextResponse.json({ count: count ?? 0 });
}
