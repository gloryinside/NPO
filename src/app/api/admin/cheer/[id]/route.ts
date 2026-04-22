import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { setCheerHidden, setCheerPublished } from '@/lib/cheer/messages'
import { revalidateCheerCampaignPath } from '@/lib/cheer/revalidate'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * PATCH /api/admin/cheer/[id]
 *
 * admin 전용: 응원 메시지 숨김 토글.
 * Body: { hidden: boolean, reason?: string }
 *
 * tenant 격리 — 대상 cheer의 org_id가 현 tenant와 다르면 404.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const hasHidden = typeof body.hidden === 'boolean'
  const hasPublished = typeof body.published === 'boolean'
  if (!hasHidden && !hasPublished) {
    return NextResponse.json(
      { error: 'invalid_body', detail: 'hidden or published required' },
      { status: 400 }
    )
  }
  const reason =
    typeof body.reason === 'string' && body.reason.trim().length > 0
      ? body.reason.trim().slice(0, 500)
      : null

  const supabase = createSupabaseAdminClient()

  // tenant 격리 검증
  const { data: existing } = await supabase
    .from('cheer_messages')
    .select('id, org_id')
    .eq('id', id)
    .eq('org_id', guard.ctx.tenant.id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  if (hasHidden) {
    const ok = await setCheerHidden(
      supabase,
      id,
      body.hidden as boolean,
      reason
    )
    if (!ok) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
  }
  if (hasPublished) {
    const ok = await setCheerPublished(
      supabase,
      id,
      body.published as boolean
    )
    if (!ok) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 })
    }
  }

  // G-116: 숨김/공개 상태 변경 시 ISR 즉시 무효화
  await revalidateCheerCampaignPath(supabase, id)

  return NextResponse.json({
    ok: true,
    id,
    hidden: hasHidden ? body.hidden : undefined,
    published: hasPublished ? body.published : undefined,
  })
}
