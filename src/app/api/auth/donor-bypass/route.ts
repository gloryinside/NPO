import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { getTenant } from '@/lib/tenant/context'
import { signOtpToken, otpSessionCookieConfig } from '@/lib/auth/otp-session'
import {
  BYPASS_FIXED_CODE,
  classifyIdentifier,
  isDonorAuthBypassEnabled,
} from '@/lib/auth/donor-bypass'
import { generateMemberCode } from '@/lib/codes'

/**
 * POST /api/auth/donor-bypass
 *
 * 개발용 로그인 우회 엔드포인트. "아무 이메일/연락처 + 고정 코드"로
 * member를 찾거나 생성하고 OTP JWT 쿠키를 발급한다.
 *
 * body: { identifier: string, code: string }
 *
 * 응답:
 *   200 { ok: true, memberId, created }
 *   403 if bypass 비활성 (프로덕션 자동 차단)
 *   400 invalid input / invalid code
 */
export async function POST(req: NextRequest) {
  if (!isDonorAuthBypassEnabled()) {
    return NextResponse.json({ error: 'bypass_disabled' }, { status: 403 })
  }

  const tenant = await getTenant()
  if (!tenant) {
    return NextResponse.json({ error: 'tenant_not_resolved' }, { status: 400 })
  }

  let body: { identifier?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const code = typeof body.code === 'string' ? body.code : ''
  if (code !== BYPASS_FIXED_CODE) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }

  const identifierRaw =
    typeof body.identifier === 'string' ? body.identifier : ''
  const id = classifyIdentifier(identifierRaw)
  if (!id) {
    return NextResponse.json({ error: 'invalid_identifier' }, { status: 400 })
  }

  const supabase = createSupabaseAdminClient()

  // 1) 기존 member 조회 — email 또는 phone 일치 + 같은 tenant
  const { data: existing } = await supabase
    .from('members')
    .select('id, status')
    .eq('org_id', tenant.id)
    .eq(id.kind, id.value)
    .maybeSingle()

  let memberId: string
  let created = false

  if (existing) {
    memberId = existing.id as string
  } else {
    // 2) 없으면 최소 정보로 신규 생성 (dev 전용)
    const { data: lastMember } = await supabase
      .from('members')
      .select('member_code')
      .eq('org_id', tenant.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const year = new Date().getFullYear()
    // 다음 seq는 (마지막 code의 뒤 5자리 + 1) 또는 1
    let nextSeq = 1
    const lastCode = lastMember?.member_code as string | undefined
    const parsed = lastCode?.match(/^M-(\d{4})(\d{5})$/)
    if (parsed && Number(parsed[1]) === year) {
      nextSeq = Number(parsed[2]) + 1
    }
    const memberCode = generateMemberCode(year, nextSeq)

    const insertRow: Record<string, unknown> = {
      org_id: tenant.id,
      member_code: memberCode,
      name: '테스트 후원자',
      status: 'active',
      [id.kind]: id.value,
      join_path: 'dev_bypass',
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('members')
      .insert(insertRow)
      .select('id')
      .maybeSingle()

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: 'member_create_failed', detail: insertErr?.message ?? null },
        { status: 500 }
      )
    }
    memberId = inserted.id as string
    created = true
  }

  // 3) OTP JWT 쿠키 발급 — 기존 OTP 세션 매커니즘 재사용
  // (phone 필드는 payload 타입 상 필수이지만 bypass에선 identifier로 대체)
  const token = await signOtpToken({
    memberId,
    orgId: tenant.id,
    phone: id.kind === 'phone' ? id.value : `bypass:${id.value}`,
  })
  const res = NextResponse.json({ ok: true, memberId, created })
  res.cookies.set(otpSessionCookieConfig(token))
  return res
}

/**
 * GET /api/auth/donor-bypass/config
 *
 * 클라이언트가 bypass 활성 여부를 확인. NEXT_PUBLIC_ 변수라 원래는
 * 클라이언트에서 직접 읽을 수 있지만, 서버-클라 일관성 검증용으로 제공.
 */
export async function GET() {
  return NextResponse.json({
    enabled: isDonorAuthBypassEnabled(),
    fixedCode: isDonorAuthBypassEnabled() ? BYPASS_FIXED_CODE : null,
  })
}
