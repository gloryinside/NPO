import { describe, it, expect } from 'vitest';
import { validateAssetUpload, sanitizeSvg } from '@/lib/campaign-builder/assets';

describe('assets', () => {
  it('accepts 1MB PNG', () => {
    expect(validateAssetUpload({ mimeType:'image/png', sizeBytes:1_000_000 }).ok).toBe(true);
  });
  it('rejects 6MB file', () => {
    expect(validateAssetUpload({ mimeType:'image/png', sizeBytes:6_000_000 }).ok).toBe(false);
  });
  it('rejects pdf', () => {
    expect(validateAssetUpload({ mimeType:'application/pdf', sizeBytes:100 }).ok).toBe(false);
  });
  it('strips script from SVG', () => {
    const out = sanitizeSvg('<svg><script>alert(1)</script><circle r="5"/></svg>');
    expect(out).not.toContain('<script');
    expect(out).toContain('<circle');
  });
});
