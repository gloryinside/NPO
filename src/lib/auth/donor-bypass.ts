/**
 * 개발용 로그인 우회(bypass) 게이트.
 *
 * - 프로덕션에선 절대 동작하지 않는다 (이중 가드).
 * - NEXT_PUBLIC_DONOR_AUTH_BYPASS=1 일 때만 활성화.
 * - 활성 상태면 로그인 페이지가 "🧪 개발용 로그인 모드" 배너와
 *   고정 코드(000000)를 노출. 서버 API는 코드 검증 없이 member를
 *   찾거나 생성하고 OTP JWT 쿠키를 발급.
 *
 * 이중 가드 이유: 환경변수 오설정(예: prod에 실수로 공개 변수 주입)에도
 * `process.env.NODE_ENV === 'production'` 조건이 있으면 코드가 아예
 * 실행되지 않는다.
 */

export const BYPASS_FIXED_CODE = '000000'

export function isDonorAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.NEXT_PUBLIC_DONOR_AUTH_BYPASS === '1'
}

/**
 * 입력을 이메일/전화번호 중 하나로 분류. "아무 입력이나" 받는 bypass용이라
 * 엄격한 검증은 안 한다 — `@` 있으면 email, 아니면 phone으로 취급.
 */
export type BypassIdentifier =
  | { kind: 'email'; value: string }
  | { kind: 'phone'; value: string }

export function classifyIdentifier(raw: string): BypassIdentifier | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (trimmed.includes('@')) {
    return { kind: 'email', value: trimmed.toLowerCase() }
  }
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 4) return null
  return { kind: 'phone', value: digits }
}
