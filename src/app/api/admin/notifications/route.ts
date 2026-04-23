import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  // G-D71: admin role 검증
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const tenantId = guard.ctx.tenant.id;

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
