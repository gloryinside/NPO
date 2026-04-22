/**
 * 테마 선호 저장·조회 유틸.
 *
 * - 쿠키 `npo_theme` (클라이언트 JS 읽기 필요 → HttpOnly 미지정)
 * - 프로덕션에서만 Secure (localhost HTTP 개발 허용)
 * - localStorage 는 별도 컴포넌트(`ThemeToggle`) 에서 fallback 으로 사용
 */

export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_COOKIE_NAME = 'npo_theme';
export const THEME_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1년

const VALID: ReadonlyArray<ThemePreference> = ['light', 'dark', 'system'];

export function parseThemePreference(
  value: string | undefined | null,
): ThemePreference | null {
  if (!value) return null;
  return (VALID as readonly string[]).includes(value)
    ? (value as ThemePreference)
    : null;
}

export function serializeThemeCookie(
  value: ThemePreference,
  opts: { isProduction: boolean },
): string {
  const parts = [
    `${THEME_COOKIE_NAME}=${value}`,
    `Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}`,
    'Path=/',
    'SameSite=Lax',
  ];
  if (opts.isProduction) parts.push('Secure');
  return parts.join('; ');
}
