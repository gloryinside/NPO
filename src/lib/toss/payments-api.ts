/**
 * 토스 결제 조회 API — 웹훅 검증용.
 * 결제 상태 변경 웹훅(PAYMENT_STATUS_CHANGED 등)에는 서명이 없다(서명은 지급대행 웹훅에만).
 * 그래서 웹훅 본문은 "어떤 결제가 바뀌었는지" 힌트로만 쓰고, 실제 상태·금액은 이 조회로 확인한다.
 * https://docs.tosspayments.com/reference#결제-조회
 */
const TOSS_BASE = 'https://api.tosspayments.com/v1'

export type TossPayment = {
  paymentKey: string
  orderId: string
  status: string // READY | IN_PROGRESS | WAITING_FOR_DEPOSIT | DONE | CANCELED | PARTIAL_CANCELED | ABORTED | EXPIRED
  totalAmount: number
  balanceAmount: number
  approvedAt: string | null
  method: string | null
}

export async function fetchTossPayment(
  secretKey: string,
  ref: { paymentKey?: string; orderId?: string },
): Promise<TossPayment | null> {
  const path = ref.paymentKey
    ? `/payments/${encodeURIComponent(ref.paymentKey)}`
    : ref.orderId
      ? `/payments/orders/${encodeURIComponent(ref.orderId)}`
      : null
  if (!path) return null
  try {
    const res = await fetch(TOSS_BASE + path, {
      headers: { Authorization: `Basic ${Buffer.from(secretKey + ':').toString('base64')}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const d = (await res.json()) as Partial<TossPayment>
    if (typeof d.paymentKey !== 'string' || typeof d.orderId !== 'string' || typeof d.status !== 'string') return null
    return {
      paymentKey: d.paymentKey,
      orderId: d.orderId,
      status: d.status,
      totalAmount: Number(d.totalAmount ?? 0),
      balanceAmount: Number(d.balanceAmount ?? 0),
      approvedAt: d.approvedAt ?? null,
      method: d.method ?? null,
    }
  } catch {
    return null
  }
}
