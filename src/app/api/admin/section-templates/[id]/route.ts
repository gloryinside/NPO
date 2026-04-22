import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'

type RouteContext = { params: Promise<{ id: string }> }

/** DELETE /api/admin/section-templates/[id] */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  const { error } = await supabase
    .from('section_templates')
    .delete()
    .eq('id', id)
    .eq('org_id', guard.ctx.tenant.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
