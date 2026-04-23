import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/api-guard';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const tenantId = guard.ctx.tenant.id;
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  await admin.from('admin_notifications').update({ read: true }).eq('id', id).eq('org_id', tenantId);
  return NextResponse.json({ ok: true });
}
