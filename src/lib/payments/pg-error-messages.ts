/**
 * SP-3: Toss Payments 에러 코드 → 한국어 사용자 친화 메시지 매핑.
 *
 * 참조: https://docs.tosspayments.com/reference/error-codes
 * 사용: 납입 실패 표시, 재시도 버튼 오류 안내
 */

export interface PgErrorInfo {
  message: string;
  action: string;
}

const TOSS_ERROR_MAP: Record<string, PgErrorInfo> = {
  CARD_EXPIRATION: {
    message: "카드 유효기간이 만료되었습니다.",
    action: "새 카드로 교체해 주세요.",
  },
  EXCEED_MAX_DAILY_AMOUNT: {
    message: "카드 일일 한도를 초과했습니다.",
    action: "내일 자동 재시도되거나 다른 카드를 등록해 주세요.",
  },
  EXCEED_MAX_MONTHLY_AMOUNT: {
    message: "카드 월 한도를 초과했습니다.",
    action: "다음 달 자동 재시도됩니다.",
  },
  INVALID_STOPPED_CARD: {
    message: "사용 정지된 카드입니다.",
    action: "카드사에 문의하거나 다른 카드로 교체해 주세요.",
  },
  INSUFFICIENT_BALANCE: {
    message: "잔액이 부족합니다.",
    action: "잔액 확인 후 재시도해 주세요.",
  },
  REJECT_CARD_COMPANY: {
    message: "카드사에서 승인을 거부했습니다.",
    action: "카드사에 문의해 주세요.",
  },
  INVALID_CARD_NUMBER: {
    message: "카드 번호가 올바르지 않습니다.",
    action: "카드 정보를 다시 확인해 주세요.",
  },
  EXCEED_MAX_ONE_DAY_WITHDRAW_AMOUNT: {
    message: "당일 출금 한도를 초과했습니다.",
    action: "내일 다시 시도해 주세요.",
  },
  CARD_PROCESSING_ERROR: {
    message: "카드 처리 중 오류가 발생했습니다.",
    action: "잠시 후 다시 시도해 주세요.",
  },
  REJECT_ACCOUNT_PAYMENT: {
    message: "계좌 결제가 거부되었습니다.",
    action: "계좌 정보를 확인해 주세요.",
  },
  FAILED_INTERNAL_SYSTEM_PROCESSING: {
    message: "내부 시스템 오류가 발생했습니다.",
    action: "잠시 후 다시 시도하거나 고객센터에 문의해 주세요.",
  },
  UNKNOWN_PAYMENT_ERROR: {
    message: "알 수 없는 결제 오류입니다.",
    action: "고객센터에 문의해 주세요.",
  },
};

const DEFAULT_ERROR: PgErrorInfo = {
  message: "결제 처리 중 오류가 발생했습니다.",
  action: "잠시 후 다시 시도하거나 고객센터에 문의해 주세요.",
};

export function getPgErrorMessage(
  code: string | null | undefined,
): PgErrorInfo {
  if (!code) return DEFAULT_ERROR;
  return TOSS_ERROR_MAP[code] ?? DEFAULT_ERROR;
}
