import { describe, it, expect } from 'vitest';
import { PageContentSchema, BlockSchema } from '@/lib/campaign-builder/blocks/schema';

describe('BlockSchema', () => {
  it('accepts hero', () => {
    const r = BlockSchema.safeParse({
      id: '11111111-1111-1111-1111-111111111111',
      type: 'hero',
      props: { backgroundImageAssetId: 'a', headline: 'H', subheadline: 'S', ctaLabel: 'Go' },
    });
    expect(r.success).toBe(true);
  });
  it('rejects unknown type', () => {
    expect(BlockSchema.safeParse({ id:'x', type:'unknown', props:{} }).success).toBe(false);
  });
  it('rejects impactStats with >6 items', () => {
    const items = Array(7).fill({ icon:'heart', value:'1', label:'x' });
    expect(BlockSchema.safeParse({ id:'i', type:'impactStats', props:{ items } }).success).toBe(false);
  });
  it('PageContentSchema requires schemaVersion', () => {
    expect(PageContentSchema.safeParse({ meta:{}, blocks:[] }).success).toBe(false);
  });
});
