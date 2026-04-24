import { describe, it, expect } from "vitest";
import {
  generateBackupCodesPlaintext,
  hashBackupCode,
  verifyBackupCode,
} from "@/lib/auth/backup-codes";

describe("backup codes", () => {
  it("generates 10 unique codes in XXXX-XXXX format", () => {
    const codes = generateBackupCodesPlaintext();
    expect(codes).toHaveLength(10);
    for (const c of codes) expect(c).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    // 중복 없음
    expect(new Set(codes).size).toBe(10);
  });

  it("verify accepts the matching plaintext", () => {
    const [code] = generateBackupCodesPlaintext();
    const { hash, salt } = hashBackupCode(code);
    expect(verifyBackupCode(code, hash, salt)).toBe(true);
  });

  it("verify rejects a different plaintext", () => {
    const [code] = generateBackupCodesPlaintext();
    const { hash, salt } = hashBackupCode(code);
    expect(verifyBackupCode("WRONG-CODE", hash, salt)).toBe(false);
  });

  it("verify normalizes input (lowercase + whitespace + hyphen)", () => {
    const [code] = generateBackupCodesPlaintext();
    const { hash, salt } = hashBackupCode(code);
    const messy = code.toLowerCase().replace("-", " ");
    expect(verifyBackupCode(messy, hash, salt)).toBe(true);
  });

  it("different salts produce different hashes for the same plaintext", () => {
    const code = "AAAA-BBBB";
    const first = hashBackupCode(code);
    const second = hashBackupCode(code);
    expect(first.salt).not.toBe(second.salt);
    expect(first.hash).not.toBe(second.hash);
  });

  it("verifyBackupCode is deterministic", () => {
    const code = "AAAA-BBBB";
    const { hash, salt } = hashBackupCode(code);
    // 동일 (hash, salt) 에 대해 verify 반복 호출 모두 true
    expect(verifyBackupCode(code, hash, salt)).toBe(true);
    expect(verifyBackupCode(code, hash, salt)).toBe(true);
  });
});
