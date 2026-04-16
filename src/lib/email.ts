/**
 * Transactional email helpers via Resend.
 *
 * Set RESEND_API_KEY in environment. All sends are fire-and-forget:
 * a failed email never breaks the calling API route.
 *
 * Sender address: "후원 알림 <noreply@{BASE_DOMAIN}>"
 * Falls back to onboarding@resend.dev if BASE_DOMAIN is unset (local dev).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

function fromAddress(orgName?: string): string {
  const label = orgName ? `${orgName} 후원 알림` : "후원 알림";
  const domain = BASE_DOMAIN || "resend.dev";
  const addr = BASE_DOMAIN ? `noreply@${BASE_DOMAIN}` : "onboarding@resend.dev";
  return `${label} <${addr}>`;
}

type SendOptions = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

async function sendEmail(opts: SendOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type DonationConfirmedParams = {
  to: string;
  memberName: string;
  orgName: string;
  campaignTitle: string | null;
  amount: number;
  paymentCode: string;
  approvedAt: string | null;
};

/**
 * 결제 승인 완료 알림 — confirmDonation() 성공 직후 호출.
 * Fire-and-forget: catch 해서 에러를 버린다.
 */
export function sendDonationConfirmed(params: DonationConfirmedParams): void {
  const {
    to,
    memberName,
    orgName,
    campaignTitle,
    amount,
    paymentCode,
    approvedAt,
  } = params;

  const dateStr = approvedAt
    ? new Date(approvedAt).toLocaleDateString("ko-KR")
    : new Date().toLocaleDateString("ko-KR");

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>후원 완료</title></head>
<body style="font-family:sans-serif;color:#111;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">${orgName}</h2>
  <p style="color:#666;margin-top:0">후원해 주셔서 감사합니다 🙏</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666;width:40%">후원자</td><td style="padding:6px 0">${memberName}</td></tr>
    <tr><td style="padding:6px 0;color:#666">캠페인</td><td style="padding:6px 0">${campaignTitle ?? "일반 후원"}</td></tr>
    <tr><td style="padding:6px 0;color:#666">금액</td><td style="padding:6px 0;font-weight:600">${fmt(amount)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">결제일</td><td style="padding:6px 0">${dateStr}</td></tr>
    <tr><td style="padding:6px 0;color:#666">결제번호</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${paymentCode}</td></tr>
  </table>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <p style="font-size:12px;color:#999">본 메일은 발신 전용입니다. 문의는 기관으로 직접 연락해 주세요.</p>
</body>
</html>`;

  sendEmail({
    from: fromAddress(orgName),
    to,
    subject: `[${orgName}] 후원 완료 — ${fmt(amount)}`,
    html,
  }).catch((err) => {
    console.error("[email] sendDonationConfirmed failed:", err);
  });
}

export type OfflineDonationReceivedParams = {
  to: string;
  memberName: string;
  orgName: string;
  campaignTitle: string | null;
  amount: number;
  paymentCode: string;
  payMethod: "transfer" | "cms" | "manual";
  donationType: "onetime" | "regular";
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
};

/**
 * 오프라인 결제 접수 알림 — 계좌이체·CMS 신청 직후 발송.
 * 관리자가 수동으로 납부 확인하면 이후 sendDonationConfirmed 가 발송된다.
 * Fire-and-forget.
 */
export function sendOfflineDonationReceived(
  params: OfflineDonationReceivedParams
): void {
  const {
    to,
    memberName,
    orgName,
    campaignTitle,
    amount,
    paymentCode,
    payMethod,
    donationType,
    bankName,
    bankAccount,
    accountHolder,
  } = params;

  const methodLabel = payMethod === "cms" ? "CMS 자동이체" : "계좌이체";
  const typeLabel = donationType === "regular" ? "정기 후원" : "일시 후원";
  const hasBank = bankName || bankAccount;

  const bankSection = hasBank
    ? `
    <div style="background:#f5f3ff;border:1px solid #c4b5fd;border-radius:8px;padding:16px;margin:20px 0">
      <p style="margin:0 0 10px;font-size:12px;font-weight:600;color:#6d28d9;text-transform:uppercase;letter-spacing:0.05em">입금 계좌 안내</p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        ${bankName ? `<tr><td style="padding:4px 0;color:#666;width:30%">은행</td><td style="padding:4px 0">${bankName}</td></tr>` : ""}
        ${bankAccount ? `<tr><td style="padding:4px 0;color:#666">계좌번호</td><td style="padding:4px 0;font-family:monospace">${bankAccount}</td></tr>` : ""}
        ${accountHolder ? `<tr><td style="padding:4px 0;color:#666">예금주</td><td style="padding:4px 0">${accountHolder}</td></tr>` : ""}
      </table>
      <p style="margin:12px 0 0;font-size:12px;color:#666">입금자 명에 이름(${memberName})을 기재해 주세요.</p>
    </div>`
    : `<p style="font-size:13px;color:#666;margin:20px 0">담당자가 연락하여 입금 안내를 드릴 예정입니다.</p>`;

  const cmsNote =
    payMethod === "cms"
      ? `<p style="font-size:13px;color:#666;margin:12px 0">CMS 자동이체는 신청 접수 후 담당자가 이체 동의서를 안내해 드립니다.</p>`
      : "";

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>후원 신청 접수</title></head>
<body style="font-family:sans-serif;color:#111;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">${orgName}</h2>
  <p style="color:#666;margin-top:0">${methodLabel} 신청이 접수되었습니다.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666;width:40%">후원자</td><td style="padding:6px 0">${memberName}</td></tr>
    <tr><td style="padding:6px 0;color:#666">캠페인</td><td style="padding:6px 0">${campaignTitle ?? "일반 후원"}</td></tr>
    <tr><td style="padding:6px 0;color:#666">후원 유형</td><td style="padding:6px 0">${typeLabel}</td></tr>
    <tr><td style="padding:6px 0;color:#666">결제 수단</td><td style="padding:6px 0">${methodLabel}</td></tr>
    <tr><td style="padding:6px 0;color:#666">신청 금액</td><td style="padding:6px 0;font-weight:600">${fmt(amount)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">접수번호</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${paymentCode}</td></tr>
  </table>
  ${bankSection}
  ${cmsNote}
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <p style="font-size:12px;color:#999">입금 확인 후 후원 완료 메일이 추가로 발송됩니다.</p>
</body>
</html>`;

  sendEmail({
    from: fromAddress(orgName),
    to,
    subject: `[${orgName}] ${methodLabel} 후원 신청이 접수되었습니다`,
    html,
  }).catch((err) => {
    console.error("[email] sendOfflineDonationReceived failed:", err);
  });
}

export type ReceiptIssuedParams = {
  to: string;
  memberName: string;
  orgName: string;
  year: number;
  totalAmount: number;
  receiptCode: string;
  pdfUrl: string | null;
};

/**
 * 기부금 영수증 발급 알림 — GET /api/admin/receipts/[memberId] 완료 후 호출.
 * Fire-and-forget.
 */
export function sendReceiptIssued(params: ReceiptIssuedParams): void {
  const { to, memberName, orgName, year, totalAmount, receiptCode, pdfUrl } =
    params;

  const downloadSection = pdfUrl
    ? `<p style="margin:20px 0"><a href="${pdfUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:14px">영수증 PDF 다운로드</a></p>`
    : `<p style="font-size:13px;color:#666">PDF 영수증은 기관 관리자에게 문의해 주세요.</p>`;

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><title>기부금 영수증</title></head>
<body style="font-family:sans-serif;color:#111;max-width:480px;margin:0 auto;padding:24px">
  <h2 style="margin-bottom:4px">${orgName}</h2>
  <p style="color:#666;margin-top:0">${year}년 기부금 영수증이 발급되었습니다.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <table style="width:100%;border-collapse:collapse;font-size:14px">
    <tr><td style="padding:6px 0;color:#666;width:40%">수신자</td><td style="padding:6px 0">${memberName}</td></tr>
    <tr><td style="padding:6px 0;color:#666">연도</td><td style="padding:6px 0">${year}년</td></tr>
    <tr><td style="padding:6px 0;color:#666">기부 합계</td><td style="padding:6px 0;font-weight:600">${fmt(totalAmount)}</td></tr>
    <tr><td style="padding:6px 0;color:#666">영수증 번호</td><td style="padding:6px 0;font-family:monospace;font-size:12px">${receiptCode}</td></tr>
  </table>
  ${downloadSection}
  <hr style="border:none;border-top:1px solid #eee;margin:20px 0">
  <p style="font-size:12px;color:#999">본 메일은 발신 전용입니다. 문의는 기관으로 직접 연락해 주세요.</p>
</body>
</html>`;

  sendEmail({
    from: fromAddress(orgName),
    to,
    subject: `[${orgName}] ${year}년 기부금 영수증 발급 완료`,
    html,
  }).catch((err) => {
    console.error("[email] sendReceiptIssued failed:", err);
  });
}
