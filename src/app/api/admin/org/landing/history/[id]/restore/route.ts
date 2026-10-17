/**
 * POST /api/admin/org/landing/history/[id]/restore
 *
 * 게시 스냅샷을 "초안"으로 되돌린다. 공개 페이지는 바뀌지 않는다 —
 * 관리자가 미리보기로 확인하고 다시 게시해야 반영된다.
 * (게시본만 바꾸는 롤백은 초안과 어긋나 다음 게시 때 원상복구되므로 쓰지 않는다)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { migrateToV2 } from '@/lib/landing-migrate'
import { sectionsOf } from '@/lib/landing/assets'
import { LANDING_SCHEMA_VERSION } from '@/lib/landing/history'
import type { LandingPageContent } from '@/types/landing'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  // org_id 조건으로 다른 기관 스냅샷은 절대 읽지 않는다
  const { data, error } = await supabase
    .from('org_landing_history')
    .select('content')
    .eq('id', id)
    .eq('org_id', tenant.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: '이력을 찾을 수 없습니다.' }, { status: 404 })

  const pageContent = migrateToV2({
    schemaVersion: 1,
    sections: sectionsOf(data.content),
  } as LandingPageContent)
  const content = { schemaVersion: LANDING_SCHEMA_VERSION, sections: pageContent.sections }

  const { error: updErr } = await supabase
    .from('orgs')
    .update({ page_content: content, updated_at: new Date().toISOString() })
    .eq('id', tenant.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, pageContent: content })
}
