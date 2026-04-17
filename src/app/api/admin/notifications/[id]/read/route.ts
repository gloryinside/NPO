import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let tenantId: string;
  try { const t = await requireTenant(); tenantId = t.id; } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  await admin.from('admin_notifications').update({ read: true }).eq('id', id).eq('org_id', tenantId);
  return NextResponse.json({ ok: true });
}
