import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/auth/api-guard'
import { createSupabaseAdminClient } from '@/lib/supabase/admin'
import { logAudit } from '@/lib/audit'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Tier S #4: 기부금 영수증 재발행.
 *
 * POST /api/admin/receipts/[id]/reissue
 * body: { reason?: string }
 *
 * 기존 receipts 행을 유지하고, 새 PDF URL을 세팅하면서
 * receipt_reissue_logs에 이력을 append한다.
 *
 * 실제 PDF 생성은 별도(관리자가 기존 receipts 엔드포인트로 생성) —
 * 이 엔드포인트는 재발행 기록만 남긴다. (PDF 교체는 후속 작업)
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: receiptId } = await params

  let body: { reason?: string; newPdfUrl?: string } = {}
  try {
    body = await req.json()
  } catch {
    // 바디 없어도 허용 (단순 재발행 기록)
  }

  const supabase = createSupabaseAdminClient()

  // 기존 영수증 확인
  const { data: receipt } = await supabase
    .from('receipts')
    .select('id, org_id, pdf_url, receipt_code, member_id, year')
    .eq('id', receiptId)
    .eq('org_id', guard.ctx.tenant.id)
    .maybeSingle()

  if (!receipt) {
    return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 })
  }

  const prevPdfUrl = receipt.pdf_url as string | null
  const newPdfUrl = body.newPdfUrl ?? prevPdfUrl

  // 재발행 로그 append
  const { error: logError } = await supabase
    .from('receipt_reissue_logs')
    .insert({
      org_id: receipt.org_id,
      receipt_id: receipt.id,
      reissued_by: guard.ctx.user.id,
      reason: body.reason?.trim() || null,
      prev_pdf_url: prevPdfUrl,
      new_pdf_url: newPdfUrl,
    })

  if (logError) {
    return NextResponse.json({ error: logError.message }, { status: 500 })
  }

  // pdf_url이 바뀌었으면 receipts 테이블도 업데이트
  if (body.newPdfUrl && body.newPdfUrl !== prevPdfUrl) {
    await supabase
      .from('receipts')
      .update({ pdf_url: body.newPdfUrl, issued_at: new Date().toISOString() })
      .eq('id', receiptId)
  }

  logAudit({
    orgId: receipt.org_id,
    actorId: guard.ctx.user.id,
    actorEmail: guard.ctx.user.email ?? null,
    action: 'receipt.reissue',
    resourceType: 'receipt',
    resourceId: receiptId,
    summary: `영수증 재발행 (${receipt.receipt_code})${body.reason ? ' — ' + body.reason : ''}`,
    metadata: { receipt_code: receipt.receipt_code, reason: body.reason ?? null },
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}

/**
 * GET /api/admin/receipts/[id]/reissue
 * 특정 영수증의 재발행 이력 조회.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const guard = await requireAdminApi()
  if (!guard.ok) return guard.response

  const { id: receiptId } = await params
  const supabase = createSupabaseAdminClient()

  const { data, error } = await supabase
    .from('receipt_reissue_logs')
    .select('id, reissued_at, reason, prev_pdf_url, new_pdf_url, reissued_by')
    .eq('receipt_id', receiptId)
    .eq('org_id', guard.ctx.tenant.id)
    .order('reissued_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ logs: data ?? [] })
}
