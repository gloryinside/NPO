import { z } from 'zod';

const PaymentMethod = z.enum(['card', 'cms', 'naverpay', 'kakaopay', 'payco', 'virtual']);
const DonationType = z.enum(['regular', 'onetime']);

const DesignationSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
});

const CustomFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'select', 'checkbox']).default('text'),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const FormSettingsSchema = z.object({
  amountPresets: z.array(z.number().int().positive()),
  allowCustomAmount: z.boolean(),
  donationTypes: z.array(DonationType),
  paymentMethods: z.array(PaymentMethod),
  designations: z.array(DesignationSchema).superRefine((items, ctx) => {
    const keys = items.map(i => i.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (dupes.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Duplicate designation keys: ${dupes.join(', ')}`,
      });
    }
  }),
  customFields: z.array(CustomFieldSchema),
  requireReceipt: z.boolean(),
  termsBodyHtml: z.string(),
  marketingOptInLabel: z.string().optional(),
  completeRedirectUrl: z.string().url().nullable(),
});

export type FormSettings = z.infer<typeof FormSettingsSchema>;

export function defaultFormSettings(): FormSettings {
  return {
    amountPresets: [10000, 30000, 50000, 100000],
    allowCustomAmount: true,
    donationTypes: ['regular', 'onetime'],
    paymentMethods: ['card'],
    designations: [],
    customFields: [],
    requireReceipt: false,
    termsBodyHtml: '',
    marketingOptInLabel: undefined,
    completeRedirectUrl: null,
  };
}
