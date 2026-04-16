import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';

describe('sanitizeHtml', () => {
  it('strips script tags', () => {
    expect(sanitizeHtml('<p>ok</p><script>x</script>')).toBe('<p>ok</p>');
  });
  it('keeps basic formatting', () => {
    const out = sanitizeHtml('<p><strong>b</strong> <a href="https://x">l</a></p>');
    expect(out).toContain('<strong>');
    expect(out).toContain('<a');
  });
  it('removes inline event handlers', () => {
    const out = sanitizeHtml('<p onclick="alert(1)">x</p>');
    expect(out).not.toContain('onclick');
  });
});
