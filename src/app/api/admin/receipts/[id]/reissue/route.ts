import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'
import { collectYearDonations, issueReceipt, loadOrgForReceipt } from '@/lib/receipt/issue'
import { checkCsrf } from '@/lib/security/csrf'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * POST /api/admin/receipts/[id]/reissue   ([id] = receipt.id)
 * body: { reason?: string }
 *
 * 실제 재발급 — 현재 납입 내역(환불 반영)으로 새 번호·새 PDF를 만들고, 이전 영수증은
 * 취소(superseded_by로 새 영수증 연결)한다. 이력은 receipt_reissue_logs + 감사 로그.
 * 예전 구현은 기록만 남기고 클라이언트가 보낸 임의 newPdfUrl을 저장했다 — 더는 받지 않는다.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const csrf = checkCsrf(req)
  if (csrf) return csrf
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response
  const { tenant, user } = guard.ctx
  const { id: receiptId } = await params

  let body: { reason?: string } = {}
  try {
    body = await req.json()
  } catch {
    // 바디 없어도 허용
  }
  const reason = typeof body.reason === 'string' ? body.reason.slice(0, 500) : null

  const supabase = createSupabaseAdminClient()
  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, pdf_url, receipt_code, member_id, year, status')
    .eq('id', receiptId)
    .eq('org_id', tenant.id)
    .maybeSingle()
  if (!receipt) return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 })
  if (receipt.status === 'cancelled') {
    return NextResponse.json({ error: '이미 취소·대체된 영수증입니다. 최신 영수증에서 재발급하세요.' }, { status: 409 })
  }

  const org = await loadOrgForReceipt(supabase, tenant.id)
  if (!org) return NextResponse.json({ error: '기관 정보를 찾을 수 없습니다.' }, { status: 404 })

  const donations = await collectYearDonations(supabase, tenant.id, receipt.year, {
    memberIds: [receipt.member_id],
    requireOptIn: false,
  })
  const result = await issueReceipt(supabase, {
    org,
    memberId: receipt.member_id,
    year: receipt.year,
    donations: donations.get(receipt.member_id),
    issuedBy: user.id,
    reissue: true,
  })

  if (result.kind === 'blocked') {
    return NextResponse.json({ error: '기관 영수증 기재사항이 없습니다.', issues: result.issues }, { status: 422 })
  }
  if (result.kind === 'no_donations') {
    return NextResponse.json({ error: '재발급할 공제 대상 납입 내역이 없습니다(전액 환불 등).' }, { status: 400 })
  }
  if (result.kind !== 'issued') {
    return NextResponse.json({ error: result.kind === 'failed' ? result.error : '재발급 실패' }, { status: 500 })
  }

  await supabase.from('receipt_reissue_logs').insert({
    org_id: tenant.id,
    receipt_id: receipt.id,
    reissued_by: user.id,
    reason,
    prev_pdf_url: receipt.pdf_url,
    new_pdf_url: result.pdfUrl,
  })
  void logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: 'receipt.reissue',
    resourceType: 'receipt',
    resourceId: result.receiptId,
    summary: `영수증 재발급 ${receipt.receipt_code} → ${result.receiptCode}${reason ? ` (${reason})` : ''}`,
  })

  return NextResponse.json({ ok: true, receiptId: result.receiptId, receiptCode: result.receiptCode, pdfUrl: result.pdfUrl })
}
