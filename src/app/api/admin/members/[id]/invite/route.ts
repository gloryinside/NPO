import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { resolveTemplate } from '@/lib/email/resolve-template'
import { sendEmail } from '@/lib/email/send-email'
import {
  logNotification,
  wasSentForRefWithin,
} from '@/lib/email/notification-log'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Phase 7-D-1 / 회원 허브: 비회원에게 로그인 초대 메일 발송.
 *
 * POST /api/admin/members/[id]/invite
 *
 * 전제:
 *   - admin 세션 + tenant 격리 (requireAdminApi)
 *   - 대상 member가 현재 tenant 소속
 *   - member.supabase_uid IS NULL (이미 연결된 회원은 ALREADY_LINKED)
 *   - member.email 존재 (없으면 NO_EMAIL)
 *
 * 쿨다운: 같은 member_id에 최근 3일 내 member_invite 발송 성공 이력이 있으면 COOLDOWN.
 * 저장소는 email_notifications_log 재사용 — 새 테이블 없음.
 *
 * 감사: audit_logs에 member.invite 기록 (actor=admin user).
 */

const COOLDOWN_DAYS = 3
const COOLDOWN_MINUTES = COOLDOWN_DAYS * 24 * 60

type InviteErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_LINKED'
  | 'NO_EMAIL'
  | 'COOLDOWN'
  | 'SEND_FAILED'

function errorResponse(
  code: InviteErrorCode,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: code, ...extra }, { status })
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id } = await params
  const supabase = createSupabaseAdminClient()

  // 1. 대상 member + tenant 격리 검증
  const { data: memberRow } = await supabase
    .from('members')
    .select('id, name, email, supabase_uid, org_id')
    .eq('id', id)
    .eq('org_id', guard.ctx.tenant.id)
    .maybeSingle()

  if (!memberRow) return errorResponse('NOT_FOUND', 404)

  const member = memberRow as {
    id: string
    name: string
    email: string | null
    supabase_uid: string | null
    org_id: string
  }

  if (member.supabase_uid) return errorResponse('ALREADY_LINKED', 400)

  const email = member.email?.trim()
  if (!email) return errorResponse('NO_EMAIL', 400)

  // 2. 쿨다운 — 최근 3일 내 성공 발송 이력 있으면 차단
  const cooldownHit = await wasSentForRefWithin(
    supabase,
    member.id,
    'member_invite',
    COOLDOWN_MINUTES
  )
  if (cooldownHit) {
    // 최근 sent_at 재조회해 retryAt 계산
    const { data: lastSent } = await supabase
      .from('email_notifications_log')
      .select('sent_at')
      .eq('ref_id', member.id)
      .eq('kind', 'member_invite')
      .eq('status', 'sent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const sentAt = (lastSent as { sent_at: string | null } | null)?.sent_at
    const retryAt = sentAt
      ? new Date(Date.parse(sentAt) + COOLDOWN_MINUTES * 60_000).toISOString()
      : null
    return errorResponse('COOLDOWN', 429, { retryAt })
  }

  // 3. 로그인 URL 구성 — tenant 도메인 유지
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  const origin = host ? `${proto}://${host}` : ''
  const loginUrl = `${origin}/donor/login?email=${encodeURIComponent(email)}`

  // 4. 템플릿 렌더링 + 발송
  const { subject, html } = await resolveTemplate(
    guard.ctx.tenant.id,
    'member_invite',
    {
      name: member.name,
      orgName: guard.ctx.tenant.name,
      email,
      loginUrl,
    }
  )

  const sendResult = await sendEmail({ to: email, subject, html })

  // 5. 로그 기록 (성공/실패 모두) + 감사 로그
  await logNotification(supabase, {
    orgId: guard.ctx.tenant.id,
    kind: 'member_invite',
    recipientEmail: email,
    refId: member.id,
    status: sendResult.success ? 'sent' : 'failed',
    error: sendResult.error ?? null,
  })

  if (!sendResult.success) {
    return errorResponse('SEND_FAILED', 500, {
      detail: sendResult.error ?? null,
    })
  }

  const sentAt = new Date().toISOString()

  // fire-and-forget — 실패해도 응답 막지 않음
  logAudit({
    orgId: guard.ctx.tenant.id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'member.invite',
    resourceType: 'member',
    resourceId: member.id,
    summary: `${member.name}(${email})에게 로그인 초대 메일 발송`,
    metadata: { email },
  }).catch(() => {})

  return NextResponse.json({ ok: true, sentAt })
}
