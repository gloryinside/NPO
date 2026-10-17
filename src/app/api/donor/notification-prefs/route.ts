import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorSession } from '@/lib/auth'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '@/lib/donor/notification-prefs'
import type { NotificationPrefs } from '@/lib/donor/notification-prefs'
import { enforceDonorLimit, limitResponse } from '@/lib/security/endpoint-limits'
import { readJsonObject } from '@/lib/http/body'

export async function GET() {
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)
  return NextResponse.json(prefs)
}

export async function PATCH(req: NextRequest) {
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const rl = enforceDonorLimit(session.member.id, 'notif:patch')
  if (!rl.allowed) return limitResponse(rl)

  const parsed = await readJsonObject<Partial<NotificationPrefs>>(req)
  if (!parsed.ok) return parsed.response
  const body = parsed.body

  const supabase = createSupabaseAdminClient()
  const result = await updateNotificationPrefs(supabase, session.member.id, body)
  if (!result) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json(result)
}
