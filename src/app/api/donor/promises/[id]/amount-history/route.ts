import { NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listAmountChanges } from '@/lib/promises/amount-change'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * GET /api/donor/promises/[id]/amount-history
 *
 * Phase 5-C: 해당 약정의 금액 변경 이력(최신순) 반환.
 *   - 본인 소유 약정에 한해 조회 가능
 *   - 동일 org 범위로 제한 (tenant isolation)
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  // 소유권 확인
  const { data: promise } = await supabase
    .from('promises')
    .select('id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle()

  if (!promise) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const history = await listAmountChanges(supabase, id)
  return NextResponse.json({ history })
}
