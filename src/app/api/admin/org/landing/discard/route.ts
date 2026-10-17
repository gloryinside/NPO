/**
 * POST /api/admin/org/landing/discard — 게시 후 바꾼 초안을 버리고 현재 게시본으로 되돌린다.
 * 게시한 적이 없으면 되돌릴 대상이 없어 409.
 */
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { migrateToV2 } from '@/lib/landing-migrate'
import { sectionsOf } from '@/lib/landing/assets'
import { LANDING_SCHEMA_VERSION } from '@/lib/landing/history'
import type { LandingPageContent } from '@/types/landing'

export async function POST() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('orgs')
    .select('published_content, published_at')
    .eq('id', tenant.id)
    .single()

  if (error || !data)
    return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })
  if (!data.published_at)
    return NextResponse.json({ error: '게시된 페이지가 없어 되돌릴 수 없습니다.' }, { status: 409 })

  const sections = migrateToV2({
    schemaVersion: 1,
    sections: sectionsOf(data.published_content),
  } as LandingPageContent).sections
  const content = { schemaVersion: LANDING_SCHEMA_VERSION, sections }

  const { error: updErr } = await supabase
    .from('orgs')
    .update({ page_content: content, updated_at: new Date().toISOString() })
    .eq('id', tenant.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })
  return NextResponse.json({ ok: true, pageContent: content })
}
