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
  const { data, error } = await admin
    .from('admin_notifications')
    .select('*')
    .eq('org_id', tenantId)
    .order('created_at', { ascending: false })
    .range(0, 49);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
