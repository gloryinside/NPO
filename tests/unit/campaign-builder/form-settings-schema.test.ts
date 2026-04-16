import { describe, it, expect } from 'vitest';
import { FormSettingsSchema, defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

describe('FormSettingsSchema', () => {
  it('accepts defaults', () => {
    expect(FormSettingsSchema.safeParse(defaultFormSettings()).success).toBe(true);
  });
  it('rejects negative amount', () => {
    expect(FormSettingsSchema.safeParse({ ...defaultFormSettings(), amountPresets: [-1] }).success).toBe(false);
  });
  it('rejects unknown method', () => {
    expect(FormSettingsSchema.safeParse({ ...defaultFormSettings(), paymentMethods: ['bitcoin'] }).success).toBe(false);
  });
  it('rejects duplicate designation keys', () => {
    expect(FormSettingsSchema.safeParse({ ...defaultFormSettings(), designations: [{key:'a',label:'A'},{key:'a',label:'B'}] }).success).toBe(false);
  });
});
