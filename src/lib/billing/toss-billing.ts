const TOSS_BASE = 'https://api.tosspayments.com/v1';

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
}

export type CardInfo = {
  cardNumber: string;
  cardExpirationYear: string;
  cardExpirationMonth: string;
  cardPassword: string;
  customerIdentityNumber: string;
};

export type BillingKeyResult =
  | { success: true; billingKey: string; customerKey: string }
  | { success: false; error: string };

export async function issueBillingKey(
  secretKey: string,
  customerKey: string,
  cardInfo: CardInfo,
): Promise<BillingKeyResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/authorizations/card`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerKey, ...cardInfo }),
    });
    const data = await res.json();
    if (!res.ok)
      return { success: false, error: data.message ?? '빌링키 발급 실패' };
    return {
      success: true,
      billingKey: data.billingKey,
      customerKey: data.customerKey,
    };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export type ChargeResult =
  | { success: true; paymentKey: string }
  | { success: false; failureCode: string; failureMessage: string };

export async function chargeBillingKey(
  secretKey: string,
  billingKey: string,
  params: {
    customerKey: string;
    amount: number;
    orderId: string;
    orderName: string;
  },
): Promise<ChargeResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok || data.status === 'ABORTED' || data.status === 'EXPIRED') {
      return {
        success: false,
        failureCode: data.code ?? 'UNKNOWN',
        failureMessage: data.message ?? '결제 실패',
      };
    }
    return { success: true, paymentKey: data.paymentKey };
  } catch (err) {
    return {
      success: false,
      failureCode: 'NETWORK_ERROR',
      failureMessage: String(err),
    };
  }
}
