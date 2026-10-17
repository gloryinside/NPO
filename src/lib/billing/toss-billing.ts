/**
 * 토스페이먼츠 자동결제(빌링) API — 서버 전용.
 * 규격: https://docs.tosspayments.com/guides/v2/billing/integration , /reference (코어 API)
 *
 *  - 빌링키 발급(권장): 결제창 requestBillingAuth → successUrl(authKey, customerKey)
 *      → POST /v1/billing/authorizations/issue
 *  - 빌링키 발급(키인): POST /v1/billing/authorizations/card — 카드번호를 서버가 받는 방식,
 *      별도 계약 필요. 하위 호환용으로만 남긴다.
 *  - 자동결제 승인: POST /v1/billing/{billingKey} + Idempotency-Key 헤더
 *  - 빌링키 삭제: DELETE /v1/billing/{billingKey} — 카드 변경·해지·탈퇴 시 반드시 호출
 */
const TOSS_BASE = 'https://api.tosspayments.com/v1'

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(secretKey + ':').toString('base64')}`
}

/** 토스 orderId 규칙: 영문 대소문자·숫자·-·_ 6~64자 */
export function toTossOrderId(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9_-]/g, '-').slice(0, 64)
  return cleaned.length >= 6 ? cleaned : cleaned.padEnd(6, '0')
}

export type CardInfo = {
  cardNumber: string
  cardExpirationYear: string
  cardExpirationMonth: string
  cardPassword: string
  customerIdentityNumber: string
}

export type BillingKeyResult =
  | {
      success: true
      billingKey: string
      customerKey: string
      card?: { number?: string; company?: string }
    }
  | { success: false; error: string; code?: string }

type TossCardResponse = {
  billingKey?: string
  customerKey?: string
  cardCompany?: string
  cardNumber?: string
  card?: { number?: string }
  code?: string
  message?: string
}

function toBillingKeyResult(res: Response, data: TossCardResponse): BillingKeyResult {
  if (!res.ok || !data.billingKey || !data.customerKey) {
    return { success: false, error: data.message ?? '빌링키 발급 실패', code: data.code }
  }
  return {
    success: true,
    billingKey: data.billingKey,
    customerKey: data.customerKey,
    card: { number: data.cardNumber ?? data.card?.number, company: data.cardCompany },
  }
}

/** [권장] 결제창 인증 결과(authKey)로 빌링키 발급 — 카드번호가 우리 서버를 거치지 않는다 */
export async function issueBillingKeyByAuth(
  secretKey: string,
  authKey: string,
  customerKey: string,
): Promise<BillingKeyResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/authorizations/issue`, {
      method: 'POST',
      headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ authKey, customerKey }),
    })
    return toBillingKeyResult(res, (await res.json()) as TossCardResponse)
  } catch (err) {
    return { success: false, error: String(err), code: 'NETWORK_ERROR' }
  }
}

/** [하위 호환] 카드 정보로 빌링키 발급(키인) — 별도 계약 필요 */
export async function issueBillingKey(
  secretKey: string,
  customerKey: string,
  cardInfo: CardInfo,
): Promise<BillingKeyResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/authorizations/card`, {
      method: 'POST',
      headers: { Authorization: authHeader(secretKey), 'Content-Type': 'application/json' },
      body: JSON.stringify({ customerKey, ...cardInfo }),
    })
    return toBillingKeyResult(res, (await res.json()) as TossCardResponse)
  } catch (err) {
    return { success: false, error: String(err), code: 'NETWORK_ERROR' }
  }
}

/**
 * 빌링키 삭제. 이미 없는 키(404)는 성공으로 본다(재시도 안전).
 * 실패해도 호출부는 DB에서 키를 지우되, 결과를 로그로 남긴다.
 */
export async function deleteBillingKey(
  secretKey: string,
  billingKey: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/${encodeURIComponent(billingKey)}`, {
      method: 'DELETE',
      headers: { Authorization: authHeader(secretKey) },
    })
    if (res.ok || res.status === 404) return { ok: true }
    const data = (await res.json().catch(() => ({}))) as { message?: string }
    return { ok: false, error: data.message ?? `HTTP ${res.status}` }
  } catch (err) {
    return { ok: false, error: String(err) }
  }
}

export type ChargeResult =
  | { success: true; paymentKey: string; approvedAt: string | null; totalAmount: number }
  | { success: false; failureCode: string; failureMessage: string; retryable: boolean }

/** 재시도해도 성공할 수 없는 실패(카드 정지·빌링키 무효 등) — 바로 사람이 봐야 한다 */
const NON_RETRYABLE = new Set([
  'NOT_MATCHES_CUSTOMER_KEY',
  'INVALID_BILLING_KEY',
  'NOT_FOUND_BILLING',
  'INVALID_STOPPED_CARD',
  'INVALID_CARD_LOST_OR_STOLEN',
  'UNAUTHORIZED_KEY',
  'AMOUNT_MISMATCH',
])

/**
 * 자동결제 승인.
 *  - Idempotency-Key: 같은 결제 시도를 두 번 보내도(타임아웃 재시도·동시 실행) 한 번만 승인된다.
 *  - 응답 검증: status === 'DONE' 이고 totalAmount가 요청 금액과 같을 때만 성공.
 */
export async function chargeBillingKey(
  secretKey: string,
  billingKey: string,
  params: {
    customerKey: string
    amount: number
    orderId: string
    orderName: string
    idempotencyKey: string
    customerEmail?: string
    customerName?: string
  },
): Promise<ChargeResult> {
  const { idempotencyKey, ...body } = params
  try {
    const res = await fetch(`${TOSS_BASE}/billing/${encodeURIComponent(billingKey)}`, {
      method: 'POST',
      headers: {
        Authorization: authHeader(secretKey),
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ ...body, orderId: toTossOrderId(body.orderId) }),
    })
    const data = (await res.json()) as {
      status?: string
      paymentKey?: string
      approvedAt?: string
      totalAmount?: number
      code?: string
      message?: string
    }
    if (!res.ok || data.status !== 'DONE' || !data.paymentKey) {
      const code = data.code ?? (res.ok ? `STATUS_${data.status ?? 'UNKNOWN'}` : 'UNKNOWN')
      return {
        success: false,
        failureCode: code,
        failureMessage: data.message ?? '결제 실패',
        retryable: !NON_RETRYABLE.has(code),
      }
    }
    if (data.totalAmount !== params.amount) {
      // 승인은 됐지만 금액이 다르다 — 성공 처리하지 않고 사람이 확인(자동 재시도 금지)
      return {
        success: false,
        failureCode: 'AMOUNT_MISMATCH',
        failureMessage: `승인 금액 불일치: 요청 ${params.amount}, 승인 ${data.totalAmount} (paymentKey ${data.paymentKey})`,
        retryable: false,
      }
    }
    return {
      success: true,
      paymentKey: data.paymentKey,
      approvedAt: data.approvedAt ?? null,
      totalAmount: data.totalAmount,
    }
  } catch (err) {
    // 네트워크 오류는 결과를 모른다 — 같은 멱등키로 재시도하면 중복 없이 결과를 받는다
    return { success: false, failureCode: 'NETWORK_ERROR', failureMessage: String(err), retryable: true }
  }
}
