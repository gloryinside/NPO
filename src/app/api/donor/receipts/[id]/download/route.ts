import { NextRequest, NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { rateLimit } from '@/lib/rate-limit';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = rateLimit(`receipts:download:${session.member.id}`, 20, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, { status: 429 });
  }

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, receipt_code, year, org_id, member_id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle();

  if (!receipt) return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 });

  const storagePath = `${receipt.org_id}/${receipt.year}/${receipt.receipt_code}.pdf`;

  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(storagePath, 3600);

  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: 'PDF를 불러올 수 없습니다.' }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
