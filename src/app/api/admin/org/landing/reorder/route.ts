/**
 * POST /api/admin/org/landing/reorder
 * body: { ids: string[] } — 새 순서대로 섹션 ID 배열
 * page_content.sections의 sortOrder를 일괄 업데이트한다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminUser } from '@/lib/auth'
import { requireTenant } from '@/lib/tenant/context'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { LandingPageContent, LandingSection } from '@/types/landing'

export async function POST(req: NextRequest) {
  await requireAdminUser()
  const tenant = await requireTenant()

  const { ids } = (await req.json()) as { ids: string[] }
  if (!Array.isArray(ids))
    return NextResponse.json({ error: 'ids 배열이 필요합니다.' }, { status: 400 })

  const supabase = createSupabaseAdminClient()

  const { data, error: fetchError } = await supabase
    .from('orgs')
    .select('page_content')
    .eq('id', tenant.id)
    .single()

  if (fetchError || !data)
    return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })

  const content = data.page_content as LandingPageContent
  const sectionMap = new Map<string, LandingSection>(
    content.sections.map((s: LandingSection) => [s.id, s])
  )

  const reordered: LandingSection[] = ids
    .filter(id => sectionMap.has(id))
    .map((id, index) => ({ ...sectionMap.get(id)!, sortOrder: index }))

  const { error } = await supabase
    .from('orgs')
    .update({
      page_content: { schemaVersion: 1, sections: reordered },
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
