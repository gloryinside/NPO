/**
 * Phase 6-B / G-106: 정기후원 약정 금액 변경 후 감사 이메일.
 *
 * - up(증액): 감사 + 임팩트 강조 ("덕분에 N배 더 많은 변화")
 * - down(감액): "계속 함께해주셔서 감사합니다" — 이탈 방지 톤
 * - same: 알림 스킵 (이벤트로서 의미 작음)
 *
 * 이 lib은 순수 HTML 빌더 + 발송 wrapper — 호출부는 changePromiseAmount 성공 후
 * fire-and-forget 패턴으로 실행한다. 실패는 주 변경 흐름을 깨지 않는다.
 */

export type AmountChangeEmailKind = 'up' | 'down'

export interface AmountChangeEmailParams {
  toEmail: string
  memberName: string
  orgName: string
  campaignTitle: string | null
  previousAmount: number
  newAmount: number
}

function fmtKRW(n: number): string {
  return n.toLocaleString('ko-KR') + '원'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderAmountChangeEmail(
  kind: AmountChangeEmailKind,
  params: AmountChangeEmailParams
): { subject: string; html: string } {
  const {
    memberName,
    orgName,
    campaignTitle,
    previousAmount,
    newAmount,
  } = params

  const safeMember = escapeHtml(memberName || '후원자')
  const safeOrg = escapeHtml(orgName || '기관')
  const campaignLabel = campaignTitle
    ? `<b>${escapeHtml(campaignTitle)}</b> 캠페인의 `
    : ''

  if (kind === 'up') {
    const ratio = previousAmount > 0 ? newAmount / previousAmount : 1
    const impactLine =
      ratio >= 1.5
        ? `이전 대비 약 ${ratio.toFixed(1)}배 규모의 지원이 됩니다.`
        : `더 많은 변화가 이어집니다.`
    const subject = `[${safeOrg}] 후원 금액 증액 감사 메일`
    const html = `
      <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
        <h2 style="color:#16a34a;margin:0 0 12px">감사합니다, ${safeMember}님 🙏</h2>
        <p style="margin:0 0 16px">
          ${campaignLabel}정기후원 금액을 <b>${fmtKRW(previousAmount)}</b>에서
          <b style="color:#16a34a">${fmtKRW(newAmount)}</b>로 증액해 주셨습니다.
        </p>
        <p style="margin:0 0 16px">
          ${impactLine} ${safeOrg}의 모든 구성원이 마음 깊이 감사드립니다.
        </p>
        <div style="margin-top:20px;padding:12px;background:#f7fff9;border-left:4px solid #16a34a;border-radius:4px">
          <p style="margin:0;font-size:13px;color:#555">
            증액된 금액은 다음 결제일부터 자동으로 반영됩니다.<br/>
            문의가 있으시면 언제든 연락 주세요.
          </p>
        </div>
      </div>
    `.trim()
    return { subject, html }
  }

  // down
  const subject = `[${safeOrg}] 계속 함께해 주셔서 감사합니다`
  const html = `
    <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
      <h2 style="color:#1a3a5c;margin:0 0 12px">계속 함께해 주셔서 감사합니다, ${safeMember}님</h2>
      <p style="margin:0 0 16px">
        ${campaignLabel}정기후원 금액이 <b>${fmtKRW(previousAmount)}</b>에서
        <b>${fmtKRW(newAmount)}</b>로 조정되었습니다.
      </p>
      <p style="margin:0 0 16px">
        어떤 크기의 마음이든, 변화의 옆에 함께 계셔 주시는 것 자체가 큰 힘이 됩니다.
        ${safeOrg}는 한 분 한 분의 참여가 이어갈 수 있도록 최선을 다하겠습니다.
      </p>
      <div style="margin-top:20px;padding:12px;background:#f7f9fc;border-left:4px solid #1a3a5c;border-radius:4px">
        <p style="margin:0;font-size:13px;color:#555">
          조정된 금액은 다음 결제일부터 적용됩니다.<br/>
          언제든 금액을 다시 변경하시거나 문의하실 수 있습니다.
        </p>
      </div>
    </div>
  `.trim()
  return { subject, html }
}
