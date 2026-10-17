/**
 * 후원 신청 동의 — 개인정보 보호법 기준으로 무엇을 알리고, 무엇을 받고, 무엇을 남기는지 한곳에서 정한다.
 *
 *  - 수집·이용 동의(제15조·제22조): 목적·항목·보유기간·거부할 권리와 불이익을 알린다. 처리방침에 '동의'를 받지 않는다.
 *  - 만 14세 미만(제22조의2): 법정대리인 동의 확인 절차가 없으므로 온라인 신청을 받지 않고 보호자 명의 후원을 안내한다.
 *  - 마케팅(선택): 필수와 따로 받고, 동의하지 않아도 후원할 수 있다.
 *  - 동의 기록(consent_records): 언제·어떤 문구 판(CONSENT_VERSION)에 동의했는지 남긴다. 문구를 바꾸면 판을 올린다.
 */

/** 동의 문구 판 — 아래 문구를 바꾸면 날짜를 올린다 */
export const CONSENT_VERSION = "2026-10-18";

export const PRIVACY_NOTICE = {
  purpose: "후원 신청 접수, 결제·정기후원 관리, 기부금영수증 발급, 후원 관련 안내(결제·영수증·약정 변경)",
  items: "이름, 휴대전화번호, 이메일 / 선택: 생년월일, 주소, 가입 경로 / 결제 시: 결제 수단·승인 정보(카드번호는 결제대행사가 직접 처리하며 기관은 받지 않음)",
  retention:
    "후원 종료(회원 탈퇴) 후 5년 — 기부금영수증 발급명세 보관 의무(법인세법 제112조의2, 소득세법 제160조의3). 기간이 지나면 지체 없이 파기합니다.",
  refusal: "동의를 거부할 수 있으나, 필수 항목에 동의하지 않으면 후원 신청을 할 수 없습니다.",
} as const;

export const MARKETING_NOTICE = {
  purpose: "기관 소식·캠페인·행사 안내",
  items: "이름, 휴대전화번호, 이메일",
  retention: "동의 철회 또는 회원 탈퇴 시까지",
  refusal: "동의하지 않아도 후원할 수 있습니다. 마이페이지 > 설정에서 언제든 철회할 수 있습니다.",
} as const;

export const UNDER_14_MESSAGE = "만 14세 미만은 온라인으로 직접 신청할 수 없습니다. 보호자 명의로 후원해 주세요.";

export type DonationConsents = { terms: boolean; privacy: boolean; over14: boolean; marketing: boolean };

/** 신청서에서 온 동의 — 필수(약관·수집이용·만 14세 이상)가 빠지면 접수하지 않는다 */
export function parseDonationConsents(
  raw: unknown,
  birthDate: string | null,
  today: string,
): { ok: true; value: DonationConsents } | { ok: false; error: string } {
  const c = (raw ?? {}) as Record<string, unknown>;
  const value: DonationConsents = {
    terms: c.terms === true,
    privacy: c.privacy === true,
    over14: c.over14 === true,
    marketing: c.marketing === true,
  };
  if (!value.terms || !value.privacy) return { ok: false, error: "필수 약관과 개인정보 수집·이용에 동의해 주세요." };
  if (!value.over14) return { ok: false, error: UNDER_14_MESSAGE };
  if (birthDate && ageOn(birthDate, today) < 14) return { ok: false, error: UNDER_14_MESSAGE };
  return { ok: true, value };
}

/** 만 나이 */
export function ageOn(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = today.split("-").map(Number) as [number, number, number];
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0);
}

export type ConsentKind = "terms" | "privacy" | "over14" | "marketing" | "rrn";

/** consent_records 에 남길 행 */
export function consentRows(
  args: { orgId: string; memberId: string | null; paymentId: string | null; consents: DonationConsents; rrn: boolean; source: string },
): Array<{ org_id: string; member_id: string | null; payment_id: string | null; kind: ConsentKind; granted: boolean; version: string; source: string }> {
  const base = { org_id: args.orgId, member_id: args.memberId, payment_id: args.paymentId, version: CONSENT_VERSION, source: args.source };
  const rows: Array<{ kind: ConsentKind; granted: boolean }> = [
    { kind: "terms", granted: args.consents.terms },
    { kind: "privacy", granted: args.consents.privacy },
    { kind: "over14", granted: args.consents.over14 },
    { kind: "marketing", granted: args.consents.marketing },
  ];
  if (args.rrn) rows.push({ kind: "rrn", granted: true });
  return rows.map((r) => ({ ...base, ...r }));
}
