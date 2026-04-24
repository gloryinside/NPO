/**
 * 어드민이 약정 상태를 변경했을 때 후원자에게 발송되는 알림 이메일.
 *
 * - cancelled: 약정 해지 안내 (사유 포함)
 * - suspended: 일시정지 안내 (재개 예정일 포함)
 * - resumed: 재개 안내 (다음 결제일 안내)
 *
 * 후원자 본인이 직접 변경한 경우는 호출하지 않는다 (admin actor만 트리거).
 */

export type PromiseStatusChangeKind = 'cancelled' | 'suspended' | 'resumed'

export interface PromiseStatusChangeEmailParams {
  toEmail: string
  memberName: string
  orgName: string
  campaignTitle: string | null
  amount: number
  reason?: string | null
  suspendedUntil?: string | null
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

function fmtDateKR(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export function renderPromiseStatusChangeEmail(
  kind: PromiseStatusChangeKind,
  params: PromiseStatusChangeEmailParams,
): { subject: string; html: string } {
  const { memberName, orgName, campaignTitle, amount, reason, suspendedUntil } = params
  const safeMember = escapeHtml(memberName || '후원자')
  const safeOrg = escapeHtml(orgName || '기관')
  const campaignLabel = campaignTitle
    ? `<b>${escapeHtml(campaignTitle)}</b> 캠페인의 `
    : ''
  const reasonLine = reason
    ? `<p style="margin:0 0 12px;font-size:13px;color:#555">사유: ${escapeHtml(reason)}</p>`
    : ''

  if (kind === 'cancelled') {
    const subject = `[${safeOrg}] 정기후원 해지 안내`
    const html = `
      <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
        <h2 style="color:#1a3a5c;margin:0 0 12px">정기후원이 해지되었습니다</h2>
        <p style="margin:0 0 12px">
          ${safeMember}님, ${campaignLabel}월 <b>${fmtKRW(amount)}</b> 정기후원이 해지 처리되었습니다.
        </p>
        ${reasonLine}
        <p style="margin:0 0 16px">
          그동안 함께해 주셔서 진심으로 감사드립니다.
          ${safeOrg}는 한 분 한 분의 마음 덕분에 한 걸음씩 나아갈 수 있었습니다.
        </p>
        <div style="margin-top:20px;padding:12px;background:#f7f9fc;border-left:4px solid #1a3a5c;border-radius:4px">
          <p style="margin:0;font-size:13px;color:#555">
            해지 사실에 오해가 있거나 다시 후원을 시작하고 싶으시다면 언제든 연락 주세요.
          </p>
        </div>
      </div>
    `.trim()
    return { subject, html }
  }

  if (kind === 'suspended') {
    const untilLabel = fmtDateKR(suspendedUntil)
    const untilLine = untilLabel
      ? `<b>${untilLabel}</b>까지 자동결제가 일시정지됩니다.`
      : `별도 재개 시까지 자동결제가 일시정지됩니다.`
    const subject = `[${safeOrg}] 정기후원 일시정지 안내`
    const html = `
      <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
        <h2 style="color:#b45309;margin:0 0 12px">정기후원이 일시정지되었습니다</h2>
        <p style="margin:0 0 12px">
          ${safeMember}님, ${campaignLabel}월 <b>${fmtKRW(amount)}</b> 정기후원이 일시정지로 전환되었습니다.
        </p>
        <p style="margin:0 0 12px">${untilLine}</p>
        ${reasonLine}
        <div style="margin-top:20px;padding:12px;background:#fffbeb;border-left:4px solid #b45309;border-radius:4px">
          <p style="margin:0;font-size:13px;color:#555">
            일시정지 기간 중에는 결제가 진행되지 않습니다.<br/>
            조기 재개 또는 해지를 원하시면 언제든 연락 주세요.
          </p>
        </div>
      </div>
    `.trim()
    return { subject, html }
  }

  // resumed
  const subject = `[${safeOrg}] 정기후원 재개 안내`
  const html = `
    <div style="font-family:system-ui,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a2e">
      <h2 style="color:#16a34a;margin:0 0 12px">정기후원이 재개되었습니다</h2>
      <p style="margin:0 0 12px">
        ${safeMember}님, ${campaignLabel}월 <b>${fmtKRW(amount)}</b> 정기후원이 다시 활성화되었습니다.
      </p>
      <p style="margin:0 0 16px">
        다음 결제일부터 자동결제가 정상적으로 진행됩니다. 다시 함께해 주셔서 감사합니다 🙏
      </p>
      <div style="margin-top:20px;padding:12px;background:#f0fdf4;border-left:4px solid #16a34a;border-radius:4px">
        <p style="margin:0;font-size:13px;color:#555">
          후원 내역과 결제일은 마이페이지에서 확인하실 수 있습니다.
        </p>
      </div>
    </div>
  `.trim()
  return { subject, html }
}
