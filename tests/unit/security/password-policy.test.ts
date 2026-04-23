import { describe, expect, it } from "vitest";
import { checkPasswordStrength } from "@/lib/security/password-policy";

describe("checkPasswordStrength", () => {
  it("8자 미만 거부", () => {
    const r = checkPasswordStrength("Abc1!");
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/8자/);
  });

  it("8자 + 2종류 이상 혼합 → 통과", () => {
    expect(checkPasswordStrength("abcdefg1").ok).toBe(true); // 소문자+숫자
    expect(checkPasswordStrength("ABCDEF!@").ok).toBe(true); // 대문자+기호
    expect(checkPasswordStrength("Abcdefgh").ok).toBe(true); // 대소문자
  });

  it("한 종류만 (영문 소문자만) 거부", () => {
    const r = checkPasswordStrength("abcdefgh");
    expect(r.ok).toBe(false);
  });

  it("흔한 비밀번호 거부", () => {
    expect(checkPasswordStrength("password").ok).toBe(false);
    expect(checkPasswordStrength("12345678").ok).toBe(false);
    expect(checkPasswordStrength("qwerty12").ok).toBe(false);
  });

  it("128자 초과 거부", () => {
    const r = checkPasswordStrength("A1".repeat(65));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/128자/);
  });

  it("앞뒤 공백 trim 후 평가", () => {
    expect(checkPasswordStrength("   abcdefg1   ").ok).toBe(true);
  });
});
