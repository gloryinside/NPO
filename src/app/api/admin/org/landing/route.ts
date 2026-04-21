/**
 * GET  /api/admin/org/landing  — 현재 편집 중인 page_content 조회
 * PATCH /api/admin/org/landing  — 섹션 배열 저장 (자동저장용)
 *   - G-41: sortOrder를 0,1,2,... 으로 정규화
 *   - G-37: 이전 page_content에 있었으나 새 page_content에 없는 이미지 URL → storage 삭제
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EMPTY_PAGE_CONTENT } from '@/lib/landing-defaults'
import { migrateToV2 } from '@/lib/landing-migrate'
import type { LandingPageContent, LandingSection } from '@/types/landing'

const BUCKET = 'campaign-assets'

/** page_content JSON 안의 이미지 URL을 모두 추출 */
function extractImageUrls(sections: LandingSection[]): Set<string> {
  const urls = new Set<string>()
  for (const section of sections) {
    const data = section.data as Record<string, unknown>
    for (const val of Object.values(data)) {
      if (typeof val === 'string' && val.startsWith('http') && /\.(jpe?g|png|webp|gif|svg)(\?|$)/i.test(val)) {
        urls.add(val)
      }
    }
  }
  return urls
}

/** public URL에서 storage path 역산 (campaign-assets/<path>) */
function urlToStoragePath(url: string): string | null {
  try {
    const u = new URL(url)
    // /storage/v1/object/public/campaign-assets/<path>
    const marker = `/object/public/${BUCKET}/`
    const idx = u.pathname.indexOf(marker)
    if (idx === -1) return null
    return u.pathname.slice(idx + marker.length)
  } catch {
    return null
  }
}

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

  const rawPageContent: LandingPageContent =
    data.page_content && typeof data.page_content === 'object' &&
    'sections' in (data.page_content as object)
      ? (data.page_content as LandingPageContent)
      : EMPTY_PAGE_CONTENT
  const pageContent = migrateToV2(rawPageContent)

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

  // G-41: sortOrder 정규화 (0, 1, 2, ...)
  const normalizedSections = pageContent.sections.map((s, i) => ({ ...s, sortOrder: i }))

  const supabase = createSupabaseAdminClient()

  // G-37: 이전 page_content에서 orphan 이미지 URL 계산
  const { data: existing } = await supabase
    .from('orgs')
    .select('page_content')
    .eq('id', tenant.id)
    .single()

  const prevSections: LandingSection[] =
    existing?.page_content &&
    typeof existing.page_content === 'object' &&
    'sections' in (existing.page_content as object)
      ? (existing.page_content as LandingPageContent).sections
      : []

  const prevUrls = extractImageUrls(prevSections)
  const newUrls = extractImageUrls(normalizedSections)

  const orphanPaths: string[] = []
  for (const url of prevUrls) {
    if (!newUrls.has(url)) {
      const path = urlToStoragePath(url)
      // orgId prefix 검증 — 다른 기관 파일 절대 삭제 안 함
      if (path && path.startsWith(`${tenant.id}/landing/`)) {
        orphanPaths.push(path)
      }
    }
  }

  const { error } = await supabase
    .from('orgs')
    .update({
      page_content: { schemaVersion: 1, sections: normalizedSections },
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  // orphan 삭제 (저장 성공 후에만 실행 — 저장 실패 시 살아있어야 함)
  if (orphanPaths.length > 0) {
    const { error: storageErr } = await supabase.storage.from(BUCKET).remove(orphanPaths)
    if (storageErr) {
      console.error('[landing PATCH] orphan storage delete failed:', storageErr.message, orphanPaths)
    }
  }

  return NextResponse.json({ ok: true })
}
