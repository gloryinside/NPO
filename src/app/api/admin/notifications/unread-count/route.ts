import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let tenantId: string;
  try { const t = await requireTenant(); tenantId = t.id; } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', tenantId)
    .eq('read', false);

  return NextResponse.json({ count: count ?? 0 });
}
