'use client';
/**
 * 토스 계좌 자동결제(퀵계좌이체 빌링) 등록 창 — 연동 자리.
 *
 * 지금 쓰는 토스 SDK(v1)는 카드 등록만 지원한다. 계좌 등록은 토스 결제 SDK v2의
 * `payment.requestBillingAuth({ method: 'TRANSFER', ... })`로 연다(토스 문서: 퀵계좌이체 자동결제 연동하기).
 * 계약·연동 전에는 orgs.account_billing_enabled 가 꺼져 있어 이 함수까지 오지 않는다.
 * 등록이 끝나면 /donate/billing/success 로 돌아와 카드와 같은 방식으로 빌링키를 발급하고,
 * 그때 출금동의(withdrawal_consents, method = pg_registration)를 함께 기록한다.
 */
export type AccountBillingAuthParams = {
  clientKey: string;
  customerKey: string;
  customerName: string;
  customerEmail?: string;
  successUrl: string;
  failUrl: string;
};

export async function requestAccountBillingAuth(params: AccountBillingAuthParams): Promise<void> {
  void params;
  throw new Error('자동이체 등록은 아직 준비 중입니다. 카드로 신청하시거나 기관에 문의해 주세요.');
}
