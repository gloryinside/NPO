import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getDonorSession } from '@/lib/auth'
import {
  getNotificationPrefs,
  updateNotificationPrefs,
} from '@/lib/donor/notification-prefs'
import type { NotificationPrefs } from '@/lib/donor/notification-prefs'
import { checkCsrf } from '@/lib/security/csrf'

export async function GET() {
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createSupabaseAdminClient()
  const prefs = await getNotificationPrefs(supabase, session.member.id)
  return NextResponse.json(prefs)
}

export async function PATCH(req: NextRequest) {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const session = await getDonorSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Partial<NotificationPrefs>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()
  const result = await updateNotificationPrefs(supabase, session.member.id, body)
  if (!result) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json(result)
}
