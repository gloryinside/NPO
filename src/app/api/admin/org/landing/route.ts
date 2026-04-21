/**
 * GET  /api/admin/org/landing  — 현재 편집 중인 page_content 조회
 * PATCH /api/admin/org/landing  — 섹션 배열 저장 (자동저장용)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EMPTY_PAGE_CONTENT } from '@/lib/landing-defaults'
import type { LandingPageContent } from '@/types/landing'

export async function GET() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('orgs')
    .select('page_content, published_content, published_at')
    .eq('id', tenant.id)
    .single()

  if (error || !data)
    return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })

  const pageContent: LandingPageContent =
    data.page_content && typeof data.page_content === 'object' &&
    'sections' in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT

  return NextResponse.json({
    pageContent,
    publishedAt: data.published_at ?? null,
    hasPublished: !!data.published_at,
  })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const body = await req.json()
  const { pageContent } = body as { pageContent: LandingPageContent }

  if (!pageContent || !Array.isArray(pageContent.sections))
    return NextResponse.json({ error: 'pageContent.sections가 필요합니다.' }, { status: 400 })

  if (pageContent.sections.length > 20)
    return NextResponse.json({ error: '섹션은 최대 20개까지 허용됩니다.' }, { status: 400 })

  const supabase = createSupabaseAdminClient()
  const { error } = await supabase
    .from('orgs')
    .update({
      page_content: { schemaVersion: 1, sections: pageContent.sections },
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
