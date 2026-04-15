import { TOSS_API_BASE, buildTossAuthHeader } from "./config";

export type TossConfirmRequest = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossPayment = {
  paymentKey: string;
  orderId: string;
  status: string;
  method?: string;
  totalAmount: number;
  approvedAt?: string;
  receipt?: { url: string };
  transactionKey?: string;
  failure?: { code: string; message: string };
};

/**
 * Toss 결제 승인 API 호출.
 *
 * 멀티테넌트 — secretKey 는 호출자가 org_secrets 에서 로드해 전달한다.
 * 성공 시 TossPayment 객체, 실패 시 code 를 포함한 Error 를 throw 한다.
 */
export async function confirmTossPayment(
  secretKey: string,
  req: TossConfirmRequest
): Promise<TossPayment> {
  const res = await fetch(`${TOSS_API_BASE}/v1/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: buildTossAuthHeader(secretKey),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(
      (data && typeof data.message === "string" && data.message) ||
        "결제 승인 실패"
    ) as Error & { code?: string };
    if (data && typeof data.code === "string") {
      err.code = data.code;
    }
    throw err;
  }

  return data as TossPayment;
}
