/**
 * 개인 기부금 세액공제 예상액 — 후원 신청 화면 안내용(순수 함수).
 *
 * 소득세법 제59조의4: 기부금의 15%(1천만원 초과분 30%)를 세액공제. 지방소득세가 그 10% 더 줄어든다.
 * 실제 공제액은 소득·다른 공제·공제 한도에 따라 달라지므로 화면에는 "약"과 함께 보여 준다.
 * 법인(기업) 기부는 세액공제가 아니라 손금산입이라 여기서 계산하지 않는다.
 */
const BASE_RATE = 0.15;
const HIGH_RATE = 0.3;
const HIGH_THRESHOLD = 10_000_000;
const LOCAL_TAX = 0.1;

export type CreditEstimate = {
  /** 1년 기부 총액 */
  annual: number;
  /** 소득세 세액공제 */
  incomeTax: number;
  /** 지방소득세 감소분 */
  localTax: number;
  /** 합계(천원 단위 내림) */
  total: number;
};

export function estimateDonationCredit(amount: number, type: "regular" | "onetime"): CreditEstimate | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const annual = Math.round(type === "regular" ? amount * 12 : amount);
  const incomeTax =
    Math.min(annual, HIGH_THRESHOLD) * BASE_RATE + Math.max(0, annual - HIGH_THRESHOLD) * HIGH_RATE;
  const localTax = incomeTax * LOCAL_TAX;
  return {
    annual,
    incomeTax: Math.floor(incomeTax),
    localTax: Math.floor(localTax),
    total: Math.floor((incomeTax + localTax) / 1000) * 1000,
  };
}
