import { describe, it, expect } from "vitest";
import { getPgErrorMessage } from "@/lib/payments/pg-error-messages";

describe("getPgErrorMessage", () => {
  it("알려진 에러 코드는 친화적 한국어 메시지를 반환", () => {
    const result = getPgErrorMessage("CARD_EXPIRATION");
    expect(result.message).toContain("만료");
    expect(result.action).toBeTruthy();
  });

  it("EXCEED_MAX_DAILY_AMOUNT는 한도 메시지를 반환", () => {
    const result = getPgErrorMessage("EXCEED_MAX_DAILY_AMOUNT");
    expect(result.message).toContain("한도");
  });

  it("알 수 없는 코드는 기본 메시지로 폴백", () => {
    const result = getPgErrorMessage("UNKNOWN_CODE_XYZ");
    expect(result.message).toBeTruthy();
    expect(result.action).toBeTruthy();
  });

  it("null/undefined/빈 문자열은 기본 메시지로 폴백", () => {
    expect(getPgErrorMessage(null).message).toBeTruthy();
    expect(getPgErrorMessage(undefined).message).toBeTruthy();
    expect(getPgErrorMessage("").message).toBeTruthy();
  });
});
