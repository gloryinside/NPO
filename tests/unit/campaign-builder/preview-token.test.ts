import { describe, it, expect } from 'vitest';
import { generatePreviewToken, verifyPreviewToken } from '@/lib/campaign-builder/preview-token';

describe('preview-token', () => {
  it('generates url-safe 22+ char token', () => {
    expect(generatePreviewToken()).toMatch(/^[A-Za-z0-9_-]{22,}$/);
  });
  it('verifies equality in constant time', () => {
    const t = generatePreviewToken();
    expect(verifyPreviewToken(t, t)).toBe(true);
    expect(verifyPreviewToken(t, t + 'x')).toBe(false);
    expect(verifyPreviewToken(null, t)).toBe(false);
  });
});
