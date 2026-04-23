/**
 * G-D53: 비밀번호 복잡도 정책.
 *
 * NIST 800-63B의 완화 기준을 따른다:
 *   - 최소 8자
 *   - 다음 4종 중 최소 2종 포함: 소문자, 대문자, 숫자, 기호
 *   - 공백은 허용하나 앞뒤 공백은 제거 후 평가
 *   - 흔한 약한 비밀번호 목록 차단 (예: password, 12345678, qwerty 등)
 *
 * 너무 엄격하게 만들면 오히려 사용자가 predictable한 비번(Password!1)을 만드는 경향이
 * 있어 NIST도 길이 > 복잡도를 권장. 본 앱은 유연성을 위해 "2 of 4" 규칙 채택.
 */

export interface PasswordCheckResult {
  ok: boolean;
  /** 실패 사유 — UI에 그대로 표시 */
  error?: string;
}

const WEAK_PASSWORDS = new Set([
  "password",
  "password1",
  "password!",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty12",
  "qwerty123",
  "abc12345",
  "letmein1",
  "admin123",
  "welcome1",
  "iloveyou",
  "monkey12",
  "dragon12",
  "00000000",
  "11111111",
]);

export function checkPasswordStrength(raw: string): PasswordCheckResult {
  const pwd = typeof raw === "string" ? raw.trim() : "";

  if (pwd.length < 8) {
    return { ok: false, error: "비밀번호는 8자 이상이어야 합니다." };
  }
  if (pwd.length > 128) {
    return { ok: false, error: "비밀번호가 너무 깁니다. 128자 이내로 입력해주세요." };
  }

  const classes =
    (/[a-z]/.test(pwd) ? 1 : 0) +
    (/[A-Z]/.test(pwd) ? 1 : 0) +
    (/[0-9]/.test(pwd) ? 1 : 0) +
    (/[^\w\s]|_/.test(pwd) ? 1 : 0);

  if (classes < 2) {
    return {
      ok: false,
      error:
        "비밀번호는 소문자/대문자/숫자/기호 중 2종류 이상을 포함해야 합니다.",
    };
  }

  if (WEAK_PASSWORDS.has(pwd.toLowerCase())) {
    return {
      ok: false,
      error: "너무 흔한 비밀번호입니다. 다른 비밀번호를 사용해주세요.",
    };
  }

  return { ok: true };
}
