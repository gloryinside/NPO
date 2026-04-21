/**
 * POST /api/admin/org/landing/publish
 * page_content → published_content 스냅샷으로 게시
 */
import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx
  const supabase = createSupabaseAdminClient()

  // 현재 page_content 조회
  const { data, error: fetchError } = await supabase
    .from('orgs')
    .select('page_content')
    .eq('id', tenant.id)
    .single()

  if (fetchError || !data)
    return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })

  const now = new Date().toISOString()

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
