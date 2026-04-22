import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

/**
 * Tier A #7: 페이지 빌더 공통 섹션 템플릿.
 *
 * GET  /api/admin/section-templates?variant=<id>  — 목록 (variant 필터 선택)
 * POST /api/admin/section-templates                — 템플릿 생성
 */

export async function GET(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const url = new URL(req.url)
  const variantId = url.searchParams.get('variant')

  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from('section_templates')
    .select('id, name, description, variant_id, block, created_at, updated_at')
    .eq('org_id', guard.ctx.tenant.id)
    .order('created_at', { ascending: false })

  if (variantId) query = query.eq('variant_id', variantId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  let body: { name?: string; description?: string; variant_id?: string; block?: unknown } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const name = body.name?.trim()
  const variantId = body.variant_id?.trim()
  if (!name || name.length > 60) {
    return NextResponse.json(
      { error: '템플릿 이름은 1-60자여야 합니다.' },
      { status: 400 },
    )
  }
  if (!variantId) {
    return NextResponse.json({ error: 'variant_id 필수' }, { status: 400 })
  }
  if (!body.block || typeof body.block !== 'object') {
    return NextResponse.json({ error: 'block 필수' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('section_templates')
    .insert({
      org_id: guard.ctx.tenant.id,
      name,
      description: body.description?.trim() || null,
      variant_id: variantId,
      block: body.block,
      created_by: guard.ctx.user.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}
