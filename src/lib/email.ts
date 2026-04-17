/**
 * Transactional email helpers via Resend.
 *
 * Set RESEND_API_KEY in environment. All sends are fire-and-forget:
 * a failed email never breaks the calling API route.
 *
 * Sender address: "후원 알림 <noreply@{BASE_DOMAIN}>"
 * Falls back to onboarding@resend.dev if BASE_DOMAIN is unset (local dev).
 */

import { resolveTemplate } from '@/lib/email/resolve-template';
import type { ScenarioKey } from '@/lib/email/default-templates';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

function fromAddress(orgName?: string): string {
  const label = orgName ? `${orgName} 후원 알림` : "후원 알림";
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

async function sendViaTemplate(
  orgId: string,
  scenario: ScenarioKey,
  variables: Record<string, string>,
  to: string,
  orgName: string,
): Promise<void> {
  const { subject, html } = await resolveTemplate(orgId, scenario, variables);
  await sendEmail({ from: fromAddress(orgName), to, subject, html });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type DonationConfirmedParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  campaignTitle: string | null;
  amount: number;
  paymentCode: string;
  approvedAt: string | null;
};

export function sendDonationConfirmed(params: DonationConfirmedParams): void {
  const { orgId, to, memberName, orgName, campaignTitle, amount, paymentCode, approvedAt } = params;
  const dateStr = approvedAt
    ? new Date(approvedAt).toLocaleDateString("ko-KR")
    : new Date().toLocaleDateString("ko-KR");

  sendViaTemplate(orgId, 'donation_thanks', {
    name: memberName,
    amount: fmt(amount),
    type: '일시',
    orgName,
    campaignTitle: campaignTitle ?? '일반 후원',
    paymentCode,
    date: dateStr,
  }, to, orgName).catch((err) => {
    console.error("[email] sendDonationConfirmed failed:", err);
  });
}

export type OfflineDonationReceivedParams = {
  orgId: string;
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

export function sendOfflineDonationReceived(params: OfflineDonationReceivedParams): void {
  const { orgId, to, memberName, orgName, campaignTitle, amount, paymentCode, payMethod, bankName, bankAccount, accountHolder } = params;
  const methodLabel = payMethod === "cms" ? "CMS 자동이체" : "계좌이체";

  sendViaTemplate(orgId, 'offline_received', {
    name: memberName,
    amount: fmt(amount),
    orgName,
    campaignTitle: campaignTitle ?? '일반 후원',
    paymentCode,
    payMethod: methodLabel,
    bankName: bankName ?? '',
    bankAccount: bankAccount ?? '',
    accountHolder: accountHolder ?? '',
  }, to, orgName).catch((err) => {
    console.error("[email] sendOfflineDonationReceived failed:", err);
  });
}

export type ReceiptIssuedParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  year: number;
  totalAmount: number;
  receiptCode: string;
  pdfUrl: string | null;
};

export function sendReceiptIssued(params: ReceiptIssuedParams): void {
  const { orgId, to, memberName, orgName, year, totalAmount, receiptCode, pdfUrl } = params;

  sendViaTemplate(orgId, 'receipt_issued', {
    name: memberName,
    orgName,
    year: String(year),
    totalAmount: fmt(totalAmount),
    receiptCode,
    pdfUrl: pdfUrl ?? '마이페이지에서 확인',
  }, to, orgName).catch((err) => {
    console.error("[email] sendReceiptIssued failed:", err);
  });
}

export type BillingFailedEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  amount: number;
  reason: string;
};

export function sendBillingFailedEmail(params: BillingFailedEmailParams): void {
  const { orgId, to, memberName, orgName, amount, reason } = params;

  sendViaTemplate(orgId, 'billing_failed', {
    name: memberName,
    orgName,
    amount: fmt(amount),
    reason,
  }, to, orgName).catch((err) => {
    console.error("[email] sendBillingFailedEmail failed:", err);
  });
}

export type BillingReminderEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  amount: number;
  date: string;
};

export function sendBillingReminderEmail(params: BillingReminderEmailParams): void {
  const { orgId, to, memberName, orgName, amount, date } = params;

  sendViaTemplate(orgId, 'billing_reminder', {
    name: memberName,
    orgName,
    amount: fmt(amount),
    date,
  }, to, orgName).catch((err) => {
    console.error("[email] sendBillingReminderEmail failed:", err);
  });
}

export type WelcomeEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
};

export function sendWelcomeEmail(params: WelcomeEmailParams): void {
  const { orgId, to, memberName, orgName } = params;

  sendViaTemplate(orgId, 'welcome', {
    name: memberName,
    orgName,
  }, to, orgName).catch((err) => {
    console.error("[email] sendWelcomeEmail failed:", err);
  });
}
