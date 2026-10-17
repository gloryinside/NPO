import { z } from 'zod';

const PaymentMethod = z.enum(['card', 'cms', 'naverpay', 'kakaopay', 'payco', 'virtual']);
const DonationType = z.enum(['regular', 'onetime']);

const DesignationSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** 한 줄 설명 — 여러 사업 담기 화면에 보인다 */
  description: z.string().max(120).optional(),
  /** 회계 사업(programs.id) — 연결하면 이 목적으로 들어온 돈이 그 사업 수입으로 배분된다 */
  programId: z.string().uuid().nullable().optional(),
});

const CustomFieldSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'select', 'checkbox']).default('text'),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
});

export const FormSettingsSchema = z.object({
  amountPresets: z.array(z.number().int().positive()),
  amountDescriptions: z.record(z.string(), z.string()).optional(),
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
  /** single: 목적 하나 고르기 / basket: 여러 사업을 골라 사업마다 금액 정하기 */
  designationMode: z.enum(['single', 'basket']).default('single'),
  /** 정기후원 신청 때 결연할 아이를 고르게 한다(공개로 설정된 아이만) */
  sponsorshipPick: z.boolean().default(false),
  /** 고를 수 있는 아이를 이 사업 소속으로 좁힌다 */
  sponsorshipProgramId: z.string().uuid().nullable().optional(),
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
    designationMode: 'single',
    sponsorshipPick: false,
    customFields: [],
    requireReceipt: false,
    termsBodyHtml: '',
    marketingOptInLabel: undefined,
    completeRedirectUrl: null,
  };
}
