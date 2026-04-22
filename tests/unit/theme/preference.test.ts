import { describe, it, expect } from 'vitest';
import {
  parseThemePreference,
  serializeThemeCookie,
  THEME_COOKIE_NAME,
} from '@/lib/theme/preference';

describe('parseThemePreference', () => {
  it('returns "light" for valid light', () => {
    expect(parseThemePreference('light')).toBe('light');
  });

  it('returns "dark" for valid dark', () => {
    expect(parseThemePreference('dark')).toBe('dark');
  });

  it('returns "system" for valid system', () => {
    expect(parseThemePreference('system')).toBe('system');
  });

  it('returns null for invalid value', () => {
    expect(parseThemePreference('purple')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseThemePreference(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseThemePreference('')).toBeNull();
  });
});

describe('serializeThemeCookie', () => {
  it('builds cookie string with all required attributes', () => {
    const out = serializeThemeCookie('light', { isProduction: true });
    expect(out).toContain('npo_theme=light');
    expect(out).toContain('Max-Age=31536000');
    expect(out).toContain('SameSite=Lax');
    expect(out).toContain('Path=/');
    expect(out).toContain('Secure');
  });

  it('omits Secure in non-production', () => {
    const out = serializeThemeCookie('dark', { isProduction: false });
    expect(out).toContain('npo_theme=dark');
    expect(out).not.toContain('Secure');
  });

  it('never sets HttpOnly (client must read)', () => {
    const out = serializeThemeCookie('system', { isProduction: true });
    expect(out).not.toContain('HttpOnly');
  });
});

describe('THEME_COOKIE_NAME', () => {
  it('is "npo_theme"', () => {
    expect(THEME_COOKIE_NAME).toBe('npo_theme');
  });
});
