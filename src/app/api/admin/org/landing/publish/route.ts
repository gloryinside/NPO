/**
 * POST /api/admin/org/landing/publish
 *
 * G-43: sections body를 직접 받으면 page_content 업데이트 + published_content 복사를
 * 한 번의 UPDATE로 처리해 debounce race 방지.
 * body가 없으면 기존처럼 현재 page_content를 스냅샷.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import type { LandingSection } from '@/types/landing'

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx
  const supabase = createSupabaseAdminClient()

  // G-43: sections를 body에서 받으면 page_content + published_content 동시 갱신
  let body: { sections?: LandingSection[] } = {}
  try {
    body = await req.json()
  } catch {
    // body 없음 — 기존 플로우
  }

  const now = new Date().toISOString()

  if (body.sections && Array.isArray(body.sections)) {
    const normalizedSections = body.sections.map((s, i) => ({ ...s, sortOrder: i }))
    const content = { schemaVersion: 1, sections: normalizedSections }

    const { error } = await supabase
      .from('orgs')
      .update({
        page_content: content,
        published_content: content,
        published_at: now,
        updated_at: now,
      })
      .eq('id', tenant.id)

    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, publishedAt: now })
  }

  // 기존 플로우: page_content를 읽어서 published_content에 복사
  const { data, error: fetchError } = await supabase
    .from('orgs')
    .select('page_content')
    .eq('id', tenant.id)
    .single()

  if (fetchError || !data)
    return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })

  const { error } = await supabase
    .from('orgs')
    .update({
      published_content: data.page_content,
      published_at: now,
      updated_at: now,
    })
    .eq('id', tenant.id)

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, publishedAt: now })
}
