import { sendAlimtalk } from './alimtalk-client';
import { sendSms } from '@/lib/sms/nhn-client';
import { TEMPLATES } from './templates';
import { sendDonationConfirmed, sendReceiptIssued as sendReceiptEmail } from '@/lib/email';

function fmt(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

async function sendWithFallback(phone: string | null, templateCode: string, params: Record<string, string>, smsBody: string): Promise<void> {
  if (!phone) return;
  const result = await sendAlimtalk(phone, templateCode, params);
  if (!result.success) {
    await sendSms(phone, smsBody);
  }
}

// ── 후원 완료 감사 ───
export type DonationThanksParams = {
  phone: string | null;
  email: string | null;
  name: string;
  amount: number;
  type: 'onetime' | 'regular';
  orgName: string;
  campaignTitle: string | null;
  paymentCode: string;
  approvedAt: string | null;
};

export function notifyDonationThanks(params: DonationThanksParams): void {
  const { phone, email, name, amount, type, orgName, campaignTitle, paymentCode, approvedAt } = params;
  const typeLabel = type === 'regular' ? '정기' : '일시';
  const amountStr = fmt(amount);

  void sendWithFallback(phone, TEMPLATES.DONATION_THANKS.code, {
    name, amount: amountStr, type: typeLabel, orgName,
  }, TEMPLATES.DONATION_THANKS.smsBody({ name, amount: amountStr, type: typeLabel, orgName }));

  if (email) {
    sendDonationConfirmed({ to: email, memberName: name, orgName, campaignTitle, amount, paymentCode, approvedAt });
  }
}

// ── 영수증 발급 완료 ───
export type ReceiptIssuedParams = {
  phone: string | null;
  email: string | null;
  name: string;
  year: number;
  pdfUrl: string | null;
  orgName: string;
  receiptCode: string;
  totalAmount: number;
};

export function notifyReceiptIssued(params: ReceiptIssuedParams): void {
  const { phone, email, name, year, pdfUrl, orgName, receiptCode, totalAmount } = params;
  const link = pdfUrl ?? '마이페이지에서 확인';

  void sendWithFallback(phone, TEMPLATES.RECEIPT_ISSUED.code, {
    name, year: String(year), link,
  }, TEMPLATES.RECEIPT_ISSUED.smsBody({ name, year: String(year), orgName }));

  if (email) {
    sendReceiptEmail({ to: email, memberName: name, orgName, year, receiptCode, totalAmount, pdfUrl });
  }
}

// ── 결제 실패 (후원자) ───
export type BillingFailedParams = {
  phone: string | null;
  name: string;
  amount: number;
  reason: string;
  orgName: string;
};

export function notifyBillingFailed(params: BillingFailedParams): void {
  const { phone, name, amount, reason, orgName } = params;
  const amountStr = fmt(amount);

  void sendWithFallback(phone, TEMPLATES.BILLING_FAILED.code, {
    name, amount: amountStr, reason, orgName,
  }, TEMPLATES.BILLING_FAILED.smsBody({ name, amount: amountStr, orgName }));
}

// ── 결제 예정 D-3 ───
export type BillingUpcomingParams = {
  phone: string | null;
  name: string;
  date: string;
  amount: number;
  orgName: string;
};

export function notifyBillingUpcoming(params: BillingUpcomingParams): void {
  const { phone, name, date, amount, orgName } = params;
  const amountStr = fmt(amount);

  void sendWithFallback(phone, TEMPLATES.BILLING_UPCOMING.code, {
    name, date, amount: amountStr, orgName,
  }, TEMPLATES.BILLING_UPCOMING.smsBody({ name, date, amount: amountStr, orgName }));
}
