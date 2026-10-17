/**
 * 공개 후원 신청서에서 받은 후원자 정보(생년월일·주소) 정리 — 순수 함수.
 *
 * 신청서는 로그인 없이 제출된다. 그래서 이 값은 새로 만드는 후원자에게만 넣고,
 * 휴대폰·이메일로 찾은 기존 후원자의 정보는 바꾸지 않는다(빈칸 채우기도 하지 않음) —
 * 남의 휴대폰 번호만 알아도 그 사람 기록에 이메일·주소를 심을 수 있기 때문.
 * 정보 변경은 로그인한 마이페이지나 관리자 화면에서만 한다.
 */

import { checkBizNo, normalizeDigits } from "@/lib/receipt/validation";

/** "어떻게 알게 되셨나요?" 표준 선택지 — members.join_path 에 그대로 저장한다 */
export const JOIN_PATHS = ["지인 소개", "인터넷 검색", "SNS", "언론·방송", "행사·거리 캠페인", "기관 소식지", "기타"] as const;

export type DonorType = "individual" | "corporate";

export type DonorProfileInput = {
  birthDate: string | null;
  postalCode: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  joinPath: string | null;
  donorType: DonorType;
  /** 기업 후원자의 사업자등록번호(숫자 10자리) — 영수증 신청 시 필수 */
  businessNo: string | null;
};

export type DonorProfileResult = { ok: true; value: DonorProfileInput } | { ok: false; error: string };

const MAX_ADDRESS = 200;

function text(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ");
  return t ? t.slice(0, max) : null;
}

/** YYYY-MM-DD, 1900년 이후, 오늘(today) 이전의 실제 날짜만 */
export function parseBirthDate(v: unknown, today: Date = new Date()): string | null | "invalid" {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "invalid";
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return "invalid";
  if (y < 1900 || date > today) return "invalid";
  return v;
}

export function parseDonorProfile(
  body: {
    birthDate?: unknown;
    postalCode?: unknown;
    addressLine1?: unknown;
    addressLine2?: unknown;
    joinPath?: unknown;
    donorType?: unknown;
    businessNo?: unknown;
  },
  today: Date = new Date(),
): DonorProfileResult {
  const donorType: DonorType = body.donorType === "corporate" ? "corporate" : "individual";
  let businessNo: string | null = null;
  if (donorType === "corporate" && typeof body.businessNo === "string" && body.businessNo.trim()) {
    businessNo = normalizeDigits(body.businessNo);
    if (!checkBizNo(businessNo)) return { ok: false, error: "사업자등록번호를 다시 확인해 주세요." };
  }
  const joinPath = typeof body.joinPath === "string" && (JOIN_PATHS as readonly string[]).includes(body.joinPath) ? body.joinPath : null;

  // 기업은 생년월일을 받지 않는다
  const birthDate = donorType === "corporate" ? null : parseBirthDate(body.birthDate, today);
  if (birthDate === "invalid") return { ok: false, error: "생년월일을 다시 확인해 주세요." };

  const postalRaw = text(body.postalCode, 10);
  const postalCode = postalRaw ? postalRaw.replace(/[^0-9]/g, "") : null;
  // 도로명 우편번호는 5자리(구 우편번호 6자리도 남아 있어 함께 받는다)
  if (postalRaw && !/^\d{5,6}$/.test(postalCode ?? "")) return { ok: false, error: "우편번호는 숫자 5자리입니다." };

  const addressLine1 = text(body.addressLine1, MAX_ADDRESS);
  const addressLine2 = addressLine1 ? text(body.addressLine2, MAX_ADDRESS) : null;

  return {
    ok: true,
    value: { birthDate, postalCode: postalCode || null, addressLine1, addressLine2, joinPath, donorType, businessNo },
  };
}

/** members 행에 쓸 컬럼 이름 */
export function profileColumns(p: DonorProfileInput) {
  return {
    birth_date: p.birthDate,
    postal_code: p.postalCode,
    address_line1: p.addressLine1,
    address_line2: p.addressLine2,
    join_path: p.joinPath,
    member_type: p.donorType,
  };
}
