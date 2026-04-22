import { NextResponse } from 'next/server'
import { getDonorSession } from '@/lib/auth'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { ensureReferralCode } from '@/lib/donor/referral'
import { rateLimit } from '@/lib/rate-limit'

/**
 * GET /api/donor/referral/code
 *
 * Phase 5-B: 로그인된 후원자의 추천 코드를 반환한다.
 *   - 없으면 발급 (ensureReferralCode)
 *   - 있으면 기존 것 재사용 (idempotent)
 *
 * 충돌로 발급 실패 시 500. rate limit: 분당 10회.
 */
export async function GET() {
  const session = await getDonorSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const rl = rateLimit(`referral:code:${session.member.id}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  }

  const admin = createSupabaseAdminClient()
  const result = await ensureReferralCode(
    admin,
    session.member.org_id,
    session.member.id
  )

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    code: result.code.code,
    createdAt: result.code.createdAt,
  })
}
