import { NextRequest, NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { checkCsrf } from '@/lib/security/csrf';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: pledge } = await supabase
    .from('promises')
    .select('id, status, member_id, org_id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle();

  if (!pledge) return NextResponse.json({ error: '약정 정보를 찾을 수 없습니다.' }, { status: 404 });
  if (pledge.status !== 'active') return NextResponse.json({ error: '해지 가능한 상태가 아닙니다.' }, { status: 400 });

  await supabase
    .from('promises')
    .update({ status: 'cancelled' })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
