/**
 * GET  /api/admin/org/landing  — 현재 편집 중인 page_content 조회
 * PATCH /api/admin/org/landing  — 섹션 배열 저장 (자동저장용)
 *   - G-41: sortOrder를 0,1,2,... 으로 정규화
 *   - G-37: 더는 어디에서도 쓰지 않는 이미지만 storage 삭제
 *     (새 초안·현재 게시본·게시 이력 모두 확인 — 게시 중이거나 복원 가능한 이미지는 보존)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { normalizeDisplayFields } from '@/lib/landing/display'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { EMPTY_PAGE_CONTENT } from '@/lib/landing-defaults'
import { migrateToV2 } from '@/lib/landing-migrate'
import { validateSections } from '@/lib/landing-variants/validate'
import type { LandingPageContent } from '@/types/landing'
import { LANDING_BUCKET, orphanStoragePaths } from '@/lib/landing/assets'
import { LANDING_SCHEMA_VERSION } from '@/lib/landing/history'

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

  // G-56: 어드민 전용이라 public 캐시는 쓰지 않고 private + max-age 30초.
  // PATCH 직후 stale 응답 방지를 위해 must-revalidate.
  return NextResponse.json(
    {
      pageContent,
      publishedAt: data.published_at ?? null,
      hasPublished: !!data.published_at,
    },
    {
      headers: {
        'Cache-Control': 'private, max-age=30, must-revalidate',
      },
    },
  )
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
  // 표시 설정(style·schedule)은 허용값만 남긴다
  const normalizedSections = pageContent.sections.map((s, i) => ({ ...s, sortOrder: i, data: normalizeDisplayFields(s.data as Record<string, unknown>) as typeof s.data }))

  // Phase A: variant zod 검증 — 실패 시 저장 거부
  const issues = validateSections(normalizedSections)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'validation_failed', issues }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // G-37: orphan 이미지 계산 — 이전 초안에만 있던 이미지 중 새 초안·게시본·이력 어디에도 없는 것
  const { data: existing } = await supabase
    .from('orgs')
    .select('page_content, published_content')
    .eq('id', tenant.id)
    .single()

  const newContent = { schemaVersion: LANDING_SCHEMA_VERSION, sections: normalizedSections }
  let orphanPaths: string[] = []
  const { data: history, error: historyErr } = await supabase
    .from('org_landing_history')
    .select('content')
    .eq('org_id', tenant.id)
  // 이력 조회 실패(테이블 미적용 등) 시엔 무엇이 복원 가능한지 모르므로 삭제하지 않는다(fail-safe)
  if (!historyErr) {
    orphanPaths = orphanStoragePaths(tenant.id, existing?.page_content, [
      newContent,
      existing?.published_content,
      ...(history ?? []).map((h) => h.content),
    ])
  }

  const { error } = await supabase
    .from('orgs')
    .update({
      page_content: newContent,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  // orphan 삭제 (저장 성공 후에만 실행 — 저장 실패 시 살아있어야 함)
  if (orphanPaths.length > 0) {
    const { error: storageErr } = await supabase.storage.from(LANDING_BUCKET).remove(orphanPaths)
    if (storageErr) {
      console.error('[landing PATCH] orphan storage delete failed:', storageErr.message, orphanPaths)
    }
  }

  return NextResponse.json({ ok: true })
}
