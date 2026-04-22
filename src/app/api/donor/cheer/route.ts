import { NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { listOwnCheerMessages } from '@/lib/cheer/messages'

/**
 * Phase 6-B / G-111: 본인이 쓴 응원 목록.
 *   - 공개/대기/숨김 모두 반환 (본인에게는 상태 투명하게)
 */
export async function GET() {
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const supabase = createSupabaseAdminClient()
  const messages = await listOwnCheerMessages(supabase, session.member.id)
  return NextResponse.json({ messages })
}
