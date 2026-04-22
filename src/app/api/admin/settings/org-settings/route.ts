import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getOrgSettings, updateOrgSettings, type OrgSettings } from '@/lib/org/settings'

/**
 * GET /api/admin/settings/org-settings
 * PATCH /api/admin/settings/org-settings
 *
 * 관리자가 기관별 settings JSONB를 조회/수정.
 * 모든 필드는 optional — 전달된 것만 merge.
 */
export async function GET() {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  const supabase = createSupabaseAdminClient()
  const settings = await getOrgSettings(supabase, tenant.id)
  return NextResponse.json({ settings })
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant } = guard.ctx

  let body: Partial<OrgSettings>
  try {
    body = (await req.json()) as Partial<OrgSettings>
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  // 허용 필드 화이트리스트
  const allowed: Partial<OrgSettings> = {}
  if (typeof body.weekly_alert_enabled === 'boolean') {
    allowed.weekly_alert_enabled = body.weekly_alert_enabled
  }
  if (typeof body.impact_unit_amount === 'number') {
    allowed.impact_unit_amount = body.impact_unit_amount
  }
  if (typeof body.campaign_thanks_enabled === 'boolean') {
    allowed.campaign_thanks_enabled = body.campaign_thanks_enabled
  }

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: 'no_valid_fields' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const result = await updateOrgSettings(supabase, tenant.id, allowed)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  return NextResponse.json({ settings: result.settings })
}
