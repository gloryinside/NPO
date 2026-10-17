/**
 * 광고성 문자 — 정보통신망법 제50조: 수신 동의한 사람에게만, 야간(21시~다음 날 8시)에는 별도 동의 없이 보내지 않고,
 * 본문 앞에 '(광고)'와 보내는 곳, 끝에 무료 수신거부 방법을 적는다.
 * 결제·영수증·약정 변경 같은 거래 안내는 광고가 아니다(purpose: 'info').
 */

export const SMS_MAX = 90;

export type MessagePurpose = "info" | "ad";

export function composeAdSms(orgName: string, optOutPhone: string, body: string): string {
  return `(광고)${orgName}\n${body.trim()}\n무료수신거부 ${optOutPhone}`;
}

/** 광고 문자 본문에 쓸 수 있는 글자 수 */
export function adBodyLimit(orgName: string, optOutPhone: string): number {
  return SMS_MAX - composeAdSms(orgName, optOutPhone, "").length;
}

/** 한국 시간 21:00~다음 날 08:00 */
export function isAdQuietHours(now: Date = new Date()): boolean {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Seoul", hour: "numeric", hourCycle: "h23" }).format(now));
  return hour >= 21 || hour < 8;
}
