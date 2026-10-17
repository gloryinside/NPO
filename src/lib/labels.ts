import type { PayStatus, IncomeStatus } from "@/types/payment";
import type { PromiseStatus, PromiseType } from "@/types/promise";

/**
 * 상태·종류 이름 — 관리자 화면·내보내기 파일에서 같은 말을 쓰도록 한곳에 둔다.
 * (화면마다 "완료"·"결제 완료", "수입대기"·"회계 반영 전"처럼 달라 헷갈렸다.)
 * 후원자 화면의 다국어 문구는 lib/i18n/donor-messages를 쓴다.
 */

export const PAY_STATUS_LABEL: Record<PayStatus, string> = {
  paid: "결제 완료",
  pending: "결제 대기",
  unpaid: "미납",
  failed: "결제 실패",
  cancelled: "취소",
  refunded: "환불",
};

/** 회계(ERP) 수입 반영 상태 */
export const INCOME_STATUS_LABEL: Record<IncomeStatus, string> = {
  pending: "회계 반영 전",
  processing: "회계 반영 중",
  confirmed: "회계 반영됨",
  excluded: "회계 제외",
};

export const PROMISE_STATUS_LABEL: Record<PromiseStatus, string> = {
  active: "진행 중",
  suspended: "일시중지",
  cancelled: "해지",
  completed: "완료",
  pending_billing: "카드 등록 대기",
};

export const PROMISE_TYPE_LABEL: Record<PromiseType, string> = {
  regular: "정기",
  onetime: "일시",
};

export const PAY_METHOD_LABEL: Record<string, string> = {
  card: "카드",
  cms: "자동이체(CMS)",
  transfer: "계좌이체",
  virtual: "가상계좌",
  manual: "직접 받음",
  naverpay: "네이버페이",
  kakaopay: "카카오페이",
  payco: "페이코",
};

/** DB 값이 문자열로 들어오는 곳(내보내기 등)용 — 모르는 값은 그대로, 없으면 "-" */
function lookup(map: Record<string, string>, value: string | null | undefined): string {
  if (!value) return "-";
  return map[value] ?? value;
}

export const payStatusLabel = (v: string | null | undefined) => lookup(PAY_STATUS_LABEL, v);
export const incomeStatusLabel = (v: string | null | undefined) => lookup(INCOME_STATUS_LABEL, v);
export const promiseStatusLabel = (v: string | null | undefined) => lookup(PROMISE_STATUS_LABEL, v);
export const payMethodLabel = (v: string | null | undefined) => lookup(PAY_METHOD_LABEL, v);
