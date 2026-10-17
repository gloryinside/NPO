/**
 * 정기후원 신청을 어떤 길로 처리할지 정한다 — 순수 함수.
 *
 *  - card_billing    : 카드. 토스 결제창에서 카드 등록(카드번호가 우리 서버를 거치지 않음)
 *  - card_keyin      : 카드번호를 직접 받은 예전 방식(하위 호환)
 *  - account_billing : 자동이체. 토스 계좌 자동결제(퀵계좌이체 빌링) — 기관이 켰을 때만(orgs.account_billing_enabled)
 *  - offline         : 자동이체(외부 CMS 프로그램으로 청구)·계좌이체·직접 받음 — 접수만 하고 출금은 기관이 처리
 *  - unsupported     : 그 밖의 수단(간편결제·가상계좌 등)은 정기 청구 수단이 없다 — 예전엔 청구되지 않는 약정이 조용히 만들어졌다
 */
export type RegularFlow = "card_billing" | "card_keyin" | "account_billing" | "offline" | "unsupported";

/** 정기후원에 쓸 수 있는 결제수단 */
export const REGULAR_PAY_METHODS = ["card", "cms", "transfer", "manual"] as const;

export function resolveRegularFlow(args: {
  payMethod: string | null | undefined;
  accountBillingEnabled: boolean;
  hasCardNumber: boolean;
}): RegularFlow {
  const method = args.payMethod ?? "card";
  if (method === "card") return args.hasCardNumber ? "card_keyin" : "card_billing";
  if (method === "cms" && args.accountBillingEnabled) return "account_billing";
  if (method === "cms" || method === "transfer" || method === "manual") return "offline";
  return "unsupported";
}

/** 토스 결제창(빌링 등록)을 거치는 흐름인지 — 이 경우 약정을 '등록 대기'로 만들고 customerKey를 미리 저장한다 */
export function needsBillingRegistration(flow: RegularFlow): boolean {
  return flow === "card_billing" || flow === "account_billing";
}
