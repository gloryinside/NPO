import { NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { softDeleteOwnCheer } from '@/lib/cheer/messages'
import { revalidateCheerCampaignPath } from '@/lib/cheer/revalidate'
import { checkCsrf } from '@/lib/security/csrf'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * DELETE /api/donor/cheer/[id]
 *   - 본인이 쓴 응원 soft-delete (hidden=true, hidden_reason='self_deleted')
 *   - admin hidden 처리된 건은 덮어쓰지 않음(lib에서 hidden=false 조건)
 */
export async function DELETE(req: Request, { params }: RouteContext) {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const { id } = await params

  const supabase = createSupabaseAdminClient()
  // G-116: 삭제 전에 slug 조회 — soft-delete 후에는 hidden=true라도 row 자체는 남지만
  // 한 번의 lookup으로 족함. lib helper가 best-effort 처리.
  const result = await softDeleteOwnCheer(supabase, id, session.member.id)
  if (!result.ok) {
    return NextResponse.json(
      { error: result.notFound ? 'not_found' : 'delete_failed' },
      { status: result.notFound ? 404 : 500 }
    )
  }
  await revalidateCheerCampaignPath(supabase, id)
  return NextResponse.json({ ok: true, id })
}
