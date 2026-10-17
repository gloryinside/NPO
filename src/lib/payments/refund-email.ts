import { formatKRW as fmtKRW } from "@/lib/format";
/**
 * 환불 실행 후 후원자 알림 이메일.
 *
 * - 전액 환불: "전액 환불 완료" 톤
 * - 부분 환불: "부분 환불 완료" + 잔여 금액 명시
 *
 * amount-change-email 패턴과 동일: 순수 HTML 빌더 + sendEmail wrapper.
 * 호출부는 환불 성공 후 fire-and-forget으로 실행한다.
 */

export interface RefundEmailParams {
  toEmail: string
  memberName: string
  orgName: string
  campaignTitle: string | null
  paymentCode: string
  originalAmount: number
  refundAmount: number
  reasonNote?: string | null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderRefundEmail(
  params: RefundEmailParams,
): { subject: string; html: string } {
  const {
    memberName,
    orgName,
    campaignTitle,
    paymentCode,
    originalAmount,
    refundAmount,
    reasonNote,
  } = params

  const safeMember = escapeHtml(memberName || '후원자')
  const safeOrg = escapeHtml(orgName || '기관')
  const campaignLabel = campaignTitle
    ? `<b>${escapeHtml(campaignTitle)}</b> 캠페인의 `
    : ''
  const isFullRefund = refundAmount >= originalAmount
  const remaining = Math.max(0, originalAmount - refundAmount)

  const reasonLine = reasonNote
    ? `<p style="margin:0 0 12px;font-size:13px;color:#555">사유: ${escapeHtml(reasonNote)}</p>`
    : ''

  const subject = isFullRefund
    ? `[${safeOrg}] 후원금 환불 완료 안내`
    : `[${safeOrg}] 후원금 부분 환불 완료 안내`

  const headline = isFullRefund
    ? '환불이 완료되었습니다'
    : '부분 환불이 완료되었습니다'

  const detailRows = isFullRefund
    ? `
        <tr><td style="padding:6px 0;color:#555">결제번호</td><td style="padding:6px 0"><b>${escapeHtml(paymentCode)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#555">환불 금액</td><td style="padding:6px 0"><b style="color:#dc2626">${fmtKRW(refundAmount)}</b> (전액)</td></tr>
      `
    : `
        <tr><td style="padding:6px 0;color:#555">결제번호</td><td style="padding:6px 0"><b>${escapeHtml(paymentCode)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#555">원 결제 금액</td><td style="padding:6px 0">${fmtKRW(originalAmount)}</td></tr>
        <tr><td style="padding:6px 0;color:#555">환불 금액</td><td style="padding:6px 0"><b style="color:#dc2626">${fmtKRW(refundAmount)}</b></td></tr>
        <tr><td style="padding:6px 0;color:#555">잔여 금액</td><td style="padding:6px 0">${fmtKRW(remaining)}</td></tr>
      `

  const html = `
    <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
      <h2 style="color:#1a3a5c;margin:0 0 12px">${headline}</h2>
      <p style="margin:0 0 12px">
        ${safeMember}님, ${campaignLabel}후원금 환불이 정상 처리되었습니다.
      </p>
      ${reasonLine}
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;margin:12px 0;font-size:14px">
        ${detailRows}
      </table>
      <p style="margin:12px 0 0;font-size:13px;color:#555">
        실제 환불 금액 입금까지는 카드사 정책에 따라 영업일 기준 3~7일이 소요될 수 있습니다.<br/>
        문의 사항이 있으시면 ${safeOrg}로 연락 주세요.
      </p>
    </div>
  `.trim()

  return { subject, html }
}
