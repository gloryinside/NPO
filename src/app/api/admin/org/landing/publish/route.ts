/**
 * POST /api/admin/org/landing/publish
 *
 * G-43: sections body를 직접 받으면 page_content 업데이트 + published_content 복사를
 * 한 번의 UPDATE로 처리해 debounce race 방지.
 * body가 없으면 현재 page_content를 스냅샷.
 * 게시 후 org_landing_history에 스냅샷을 쌓는다(되돌리기용).
 */
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { normalizeDisplayFields } from '@/lib/landing/display'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { validateSections } from '@/lib/landing-variants/validate'
import { migrateToV2 } from '@/lib/landing-migrate'
import { sectionsOf } from '@/lib/landing/assets'
import { LANDING_SCHEMA_VERSION, recordPublish } from '@/lib/landing/history'
import type { LandingPageContent, LandingSection } from '@/types/landing'

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant, user } = guard.ctx
  const supabase = createSupabaseAdminClient()

  let body: { sections?: LandingSection[] } = {}
  try {
    body = await req.json()
  } catch {
    // body 없음 — 현재 초안을 게시
  }

  let sections: LandingSection[]
  const fromBody = Array.isArray(body.sections)
  if (fromBody) {
    sections = body.sections!
  } else {
    const { data, error: fetchError } = await supabase
      .from('orgs')
      .select('page_content')
      .eq('id', tenant.id)
      .single()
    if (fetchError || !data)
      return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })
    sections = migrateToV2({
      schemaVersion: 1,
      sections: sectionsOf(data.page_content),
    } as LandingPageContent).sections
  }

  // 표시 설정(style·schedule)은 허용값만 남긴다
  const normalizedSections = sections.map((s, i) => ({ ...s, sortOrder: i, data: normalizeDisplayFields(s.data as Record<string, unknown>) as typeof s.data }))

  // Phase A: variant zod 검증 — 초안 경로도 같은 검증을 거친다
  const issues = validateSections(normalizedSections)
  if (issues.length > 0) {
    return NextResponse.json({ error: 'validation_failed', issues }, { status: 400 })
  }

  const now = new Date().toISOString()
  const content = { schemaVersion: LANDING_SCHEMA_VERSION, sections: normalizedSections }

  const { error } = await supabase
    .from('orgs')
    .update({
      ...(fromBody ? { page_content: content } : {}),
      published_content: content,
      published_at: now,
      updated_at: now,
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')

  const history = await recordPublish(supabase, tenant.id, content, user)
  return NextResponse.json({
    ok: true,
    publishedAt: now,
    // 게시는 성공 — 이력만 못 남겼으면 편집기에서 안내한다
    historyRecorded: history.ok,
  })
}
