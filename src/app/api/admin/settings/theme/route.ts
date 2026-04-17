import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { ThemeConfigSchema } from '@/lib/theme/config';

export async function PATCH(req: NextRequest) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let tenantId: string;
  try {
    const tenant = await requireTenant();
    tenantId = tenant.id;
  } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ThemeConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid theme config', details: parsed.error.flatten() }, { status: 400 });
  }

  const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
  const adminClient = createSupabaseAdminClient();
  const { error } = await adminClient
    .from('orgs')
    .update({ theme_config: parsed.data })
    .eq('id', tenantId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
