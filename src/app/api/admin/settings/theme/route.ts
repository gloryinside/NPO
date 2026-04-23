import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/auth/api-guard';
import { ThemeConfigSchema } from '@/lib/theme/config';

export async function PATCH(req: NextRequest) {
  // G-D71: admin role 검증 (이전엔 user 존재만 확인)
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const tenantId = guard.ctx.tenant.id;

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
