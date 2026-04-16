# Donation Site Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a block-based no-code donation campaign landing page builder plus a fixed 3-step donation wizard, integrated with existing Toss Payments and campaign data.

**Architecture:** Two-layer split — (a) builder-editable story landing page driven by a JSON block tree with draft/published states, (b) fixed `/donate/wizard` reusing existing Toss integration. Storage-backed assets, zod-validated schemas, ISR-cached public renderer.

**Tech Stack:** Next.js 16 App Router · React 19 · TypeScript · Supabase (Postgres + Storage + RLS) · Toss Payments SDK · Tailwind 4 · Base-UI · Lucide · @dnd-kit/sortable · Tiptap · react-hook-form + zod · Vitest · Playwright · isomorphic-dompurify · pgcrypto.

**Spec:** `docs/superpowers/specs/2026-04-16-donation-site-builder-design.md`

**Security note:** All HTML-string rendering paths (richText block, terms HTML in wizard) MUST pass through `isomorphic-dompurify` on both save and render. Any use of React `dangerouslySetInnerHTML` in this plan receives a `DOMPurify.sanitize(...)` result — never raw input.

---

## File Structure

**Migrations** (add to `supabase/migrations/`, numbered 20260417xxxxxx_...):
- `20260417000001_campaign_builder_columns.sql` — columns on `campaigns`
- `20260417000002_campaign_assets.sql` — new `campaign_assets` table + RLS
- `20260417000003_payments_builder_columns.sql` — `designation`, `custom_fields`, `idempotency_key` on `payments`
- `20260417000004_receipts_rrn_encryption.sql` — encrypted RRN/biz columns + retention
- `20260417000005_storage_campaign_assets.sql` — Storage bucket + policies

**Library (`src/lib/campaign-builder/`)**: `blocks/schema.ts`, `blocks/registry.tsx`, `form-settings/schema.ts`, `publish.ts`, `preview-token.ts`, `assets.ts`, `progress.ts`, `sanitize-html.ts` (wraps DOMPurify once for reuse).

**Block components (`src/components/campaign-blocks/`)**: `Hero.tsx`, `RichText.tsx`, `ImageSingle.tsx`, `ImpactStats.tsx`, `FundraisingProgress.tsx`, `Faq.tsx`, `DonationQuickForm.tsx`, `SnsShare.tsx`, `BlockRenderer.tsx`.

**Editor (`src/components/campaign-builder/`)**: `Editor.tsx`, `Palette.tsx`, `Canvas.tsx`, `BlockToolbar.tsx`, `PropsPanel.tsx`, per-block form files under `forms/`, inputs under `inputs/`, `form-settings/FormSettingsPanel.tsx`.

**API**: `src/app/api/admin/campaigns/[id]/{page-content,form-settings,publish,preview-token,assets}/...`, `src/app/api/public/campaigns/[slug]/progress/route.ts`, `src/app/api/cron/purge-expired-rrn/route.ts`.

**Public**: swap `app/(public)/campaigns/[slug]/page.tsx`, add `.../preview/page.tsx`.

**Wizard**: `src/app/donate/wizard/{page.tsx, WizardClient.tsx, steps/Step1.tsx, steps/Step2.tsx, steps/Step3.tsx}`.

**Admin editor route**: `src/app/(admin)/admin/campaigns/[id]/edit/page.tsx`.

**Tests**: `tests/campaign-builder/*.test.{ts,tsx}` (unit), `tests/integration/campaign-builder/*.test.ts` (integration), `e2e/campaign-builder.spec.ts`, `e2e/donation-wizard.spec.ts`.

---

## Task 1: DB migration — campaigns columns

**Files:**
- Create: `supabase/migrations/20260417000001_campaign_builder_columns.sql`
- Test: `tests/integration/campaign-builder/migration-columns.test.ts`

- [ ] **Step 1: Write the migration**

```sql
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS page_content JSONB NOT NULL DEFAULT '{"meta":{"schemaVersion":1},"blocks":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS preview_token TEXT NULL,
  ADD COLUMN IF NOT EXISTS form_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS campaigns_preview_token_idx ON campaigns (preview_token) WHERE preview_token IS NOT NULL;

UPDATE campaigns
SET page_content = jsonb_build_object(
  'meta', jsonb_build_object('schemaVersion', 1),
  'blocks', jsonb_build_array(
    jsonb_build_object(
      'id', gen_random_uuid()::text,
      'type', 'richText',
      'props', jsonb_build_object('html', COALESCE(description, ''))
    )
  )
)
WHERE page_content = '{"meta":{"schemaVersion":1},"blocks":[]}'::jsonb
  AND description IS NOT NULL AND description <> '';

UPDATE campaigns
SET published_content = page_content,
    published_at = COALESCE(updated_at, now())
WHERE status = 'published' AND published_content = '{}'::jsonb;
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';

describe('migration 20260417000001', () => {
  it('adds new columns', async () => {
    const sb = createAdminClient();
    const { error } = await sb
      .from('campaigns')
      .select('id, page_content, published_content, published_at, preview_token, form_settings')
      .limit(1);
    expect(error).toBeNull();
  });
  it('backfills blocks from description', async () => {
    const sb = createAdminClient();
    const { data } = await sb.from('campaigns').select('page_content, description').not('description','is',null).limit(1).maybeSingle();
    if (!data) return;
    expect(Array.isArray((data.page_content as any).blocks)).toBe(true);
  });
});
```

- [ ] **Step 3: Apply migration**

Run: `supabase migration up` (or `supabase db reset` in dev)
Expected: migration applied, no errors.

- [ ] **Step 4: Run test**

Run: `npm test -- tests/integration/campaign-builder/migration-columns.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417000001_campaign_builder_columns.sql tests/integration/campaign-builder/migration-columns.test.ts
git commit -m "feat(builder): add page_content/form_settings columns to campaigns"
```

---

## Task 2: DB migration — campaign_assets table

**Files:**
- Create: `supabase/migrations/20260417000002_campaign_assets.sql`
- Test: `tests/integration/campaign-builder/campaign-assets-rls.test.ts`
- Create: `tests/integration/helpers/auth.ts` (test harness)

- [ ] **Step 1: Write migration**

```sql
CREATE TABLE IF NOT EXISTS campaign_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  campaign_id UUID NULL REFERENCES campaigns(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  width INTEGER NULL,
  height INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES members(id) ON DELETE SET NULL
);
CREATE INDEX campaign_assets_org_id_idx ON campaign_assets (org_id);
CREATE INDEX campaign_assets_campaign_id_idx ON campaign_assets (campaign_id);
ALTER TABLE campaign_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY campaign_assets_sel ON campaign_assets FOR SELECT
  USING (org_id = (SELECT org_id FROM members WHERE id = auth.uid()));
CREATE POLICY campaign_assets_ins ON campaign_assets FOR INSERT
  WITH CHECK (org_id = (SELECT org_id FROM members WHERE id = auth.uid()));
CREATE POLICY campaign_assets_del ON campaign_assets FOR DELETE
  USING (org_id = (SELECT org_id FROM members WHERE id = auth.uid()));
```

- [ ] **Step 2: Write RLS test + helper**

```ts
// tests/integration/helpers/auth.ts
import { createClient } from '@supabase/supabase-js';
export async function createUserClientForOrg(orgId: string) {
  // test harness: create a member in orgId and sign in; return an authed client.
  // Implementation follows existing test patterns in tests/integration/.
  // For first implementation, read an existing helper in tests/integration/ and adapt.
  throw new Error('implement using existing tests/integration pattern');
}
```

```ts
// tests/integration/campaign-builder/campaign-assets-rls.test.ts
import { describe, it, expect } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';
import { createUserClientForOrg } from '../helpers/auth';

describe('campaign_assets RLS', () => {
  it('blocks cross-org select', async () => {
    const admin = createAdminClient();
    const { data: orgA } = await admin.from('organizations').insert({ name: 'A-'+Date.now() }).select().single();
    const { data: orgB } = await admin.from('organizations').insert({ name: 'B-'+Date.now() }).select().single();
    await admin.from('campaign_assets').insert({
      org_id: orgA!.id, storage_path: 'a/x.png', public_url: 'https://x', mime_type: 'image/png', size_bytes: 100,
    });
    const userB = await createUserClientForOrg(orgB!.id);
    const { data } = await userB.from('campaign_assets').select('*');
    expect(data).toEqual([]);
  });
});
```

- [ ] **Step 3: Apply migration**

Run: `supabase migration up`

- [ ] **Step 4: Run test**

Run: `npm test -- tests/integration/campaign-builder/campaign-assets-rls.test.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417000002_campaign_assets.sql tests/integration/campaign-builder/campaign-assets-rls.test.ts tests/integration/helpers/auth.ts
git commit -m "feat(builder): add campaign_assets table with org-scoped RLS"
```

---

## Task 3: DB migration — payments columns

**Files:**
- Create: `supabase/migrations/20260417000003_payments_builder_columns.sql`
- Test: `tests/integration/campaign-builder/payments-columns.test.ts`

- [ ] **Step 1: Write migration**

```sql
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS designation TEXT NULL,
  ADD COLUMN IF NOT EXISTS custom_fields JSONB NULL,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT NULL;
CREATE INDEX IF NOT EXISTS payments_designation_idx ON payments (campaign_id, designation) WHERE designation IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS payments_idempotency_key_uniq ON payments (idempotency_key) WHERE idempotency_key IS NOT NULL;
```

- [ ] **Step 2: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';

describe('payments builder columns', () => {
  it('rejects duplicate idempotency_key', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').select('id, org_id').limit(1).single();
    const key = `test-${Date.now()}`;
    const base = { campaign_id: c!.id, org_id: c!.org_id, amount: 1000, idempotency_key: key, pay_status: 'pending' };
    const first = await sb.from('payments').insert(base).select().single();
    expect(first.error).toBeNull();
    const second = await sb.from('payments').insert(base);
    expect(second.error).not.toBeNull();
  });
});
```

- [ ] **Step 3: Apply migration**

Run: `supabase migration up`

- [ ] **Step 4: Run test**

Run: `npm test -- tests/integration/campaign-builder/payments-columns.test.ts`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260417000003_payments_builder_columns.sql tests/integration/campaign-builder/payments-columns.test.ts
git commit -m "feat(builder): add designation/custom_fields/idempotency_key to payments"
```

---

## Task 4: DB migration — receipts RRN encryption

**Files:**
- Create: `supabase/migrations/20260417000004_receipts_rrn_encryption.sql`

- [ ] **Step 1: Write migration**

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS resident_no_encrypted BYTEA NULL,
  ADD COLUMN IF NOT EXISTS business_no_encrypted BYTEA NULL,
  ADD COLUMN IF NOT EXISTS rrn_retention_expires_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS receipts_rrn_retention_idx ON receipts (rrn_retention_expires_at)
  WHERE rrn_retention_expires_at IS NOT NULL;
```

- [ ] **Step 2: Verify pgcrypto**

Run: `psql "$DATABASE_URL" -c "SELECT pgp_sym_decrypt(pgp_sym_encrypt('test','k'),'k');"`
Expected: returns `test`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260417000004_receipts_rrn_encryption.sql
git commit -m "feat(builder): encrypt RRN/biz on receipts with pgcrypto + 5y retention column"
```

---

## Task 5: DB migration — Storage bucket policies

**Files:**
- Create: `supabase/migrations/20260417000005_storage_campaign_assets.sql`

- [ ] **Step 1: Write migration**

```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('campaign-assets','campaign-assets',true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "campaign-assets public read" ON storage.objects FOR SELECT
  USING (bucket_id = 'campaign-assets');
CREATE POLICY "campaign-assets authed upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM members WHERE id = auth.uid()
  ));
CREATE POLICY "campaign-assets authed delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'campaign-assets' AND (storage.foldername(name))[1] IN (
    SELECT org_id::text FROM members WHERE id = auth.uid()
  ));
```

- [ ] **Step 2: Apply + manual smoke**

Run: `supabase migration up`
Then upload a test PNG via Supabase dashboard under `campaign-assets/<org_id>/test.png`, verify public URL loads.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260417000005_storage_campaign_assets.sql
git commit -m "feat(builder): campaign-assets storage bucket with org-scoped policies"
```

---

## Task 6: Shared HTML sanitizer

**Files:**
- Create: `src/lib/campaign-builder/sanitize-html.ts`
- Test: `tests/campaign-builder/sanitize-html.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Write implementation**

```ts
// src/lib/campaign-builder/sanitize-html.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p','br','strong','em','u','a','ul','ol','li','h1','h2','h3','blockquote','img','span'],
    ALLOWED_ATTR: ['href','target','rel','src','alt','title'],
  });
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/campaign-builder/sanitize-html.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/sanitize-html.ts tests/campaign-builder/sanitize-html.test.ts
git commit -m "feat(builder): shared HTML sanitizer wrapping DOMPurify"
```

---

## Task 7: Block zod schemas

**Files:**
- Create: `src/lib/campaign-builder/blocks/schema.ts`
- Test: `tests/campaign-builder/blocks-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Write schema**

```ts
// src/lib/campaign-builder/blocks/schema.ts
import { z } from 'zod';

const Common = { anchor: z.string().optional(), hiddenOn: z.array(z.enum(['mobile','desktop'])).optional() };

export const HeroProps = z.object({
  backgroundImageAssetId: z.string().min(1),
  headline: z.string().min(1).max(200),
  subheadline: z.string().max(400).optional().default(''),
  ctaLabel: z.string().min(1).max(40),
  ctaAnchorBlockId: z.string().optional(),
});
export const RichTextProps = z.object({ html: z.string().max(50_000) });
export const ImageSingleProps = z.object({
  assetId: z.string().min(1),
  altText: z.string().min(1).max(200),
  caption: z.string().max(200).optional(),
  linkUrl: z.string().url().optional(),
});
export const ImpactStatsProps = z.object({
  heading: z.string().max(200).optional(),
  items: z.array(z.object({
    icon: z.enum(['heart','users','globe','home','book','utensils','droplet','shield']),
    value: z.string().max(40),
    label: z.string().max(80),
  })).min(1).max(6),
});
export const FundraisingProgressProps = z.object({
  showDonorCount: z.boolean().default(true),
  showDDay: z.boolean().default(false),
});
export const FaqProps = z.object({
  heading: z.string().max(200).optional(),
  items: z.array(z.object({ question: z.string().max(200), answer: z.string().max(2000) })).max(30),
});
export const DonationQuickFormProps = z.object({
  heading: z.string().max(200).optional(),
  showDesignation: z.boolean().default(false),
});
export const SnsShareProps = z.object({
  channels: z.array(z.enum(['kakao','facebook','link'])).min(1),
});

export const BlockSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string().min(1), type: z.literal('hero'), props: HeroProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('richText'), props: RichTextProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('imageSingle'), props: ImageSingleProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('impactStats'), props: ImpactStatsProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('fundraisingProgress'), props: FundraisingProgressProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('faq'), props: FaqProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('donationQuickForm'), props: DonationQuickFormProps, ...Common }),
  z.object({ id: z.string().min(1), type: z.literal('snsShare'), props: SnsShareProps, ...Common }),
]);

export const PageContentSchema = z.object({
  meta: z.object({ schemaVersion: z.literal(1) }),
  blocks: z.array(BlockSchema).max(50),
});

export type Block = z.infer<typeof BlockSchema>;
export type PageContent = z.infer<typeof PageContentSchema>;
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/campaign-builder/blocks-schema.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/blocks/schema.ts tests/campaign-builder/blocks-schema.test.ts
git commit -m "feat(builder): zod schemas for 8 block types"
```

---

## Task 8: form_settings zod schema

**Files:**
- Create: `src/lib/campaign-builder/form-settings/schema.ts`
- Test: `tests/campaign-builder/form-settings-schema.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Write schema**

```ts
// src/lib/campaign-builder/form-settings/schema.ts
import { z } from 'zod';

export const FormSettingsSchema = z.object({
  amountPresets: z.array(z.number().int().positive().max(100_000_000)).min(1).max(10),
  allowCustomAmount: z.boolean(),
  donationTypes: z.array(z.enum(['regular','onetime'])).min(1),
  paymentMethods: z.array(z.enum(['card','cms','naverpay','kakaopay','payco','virtual'])).min(1),
  designations: z.array(z.object({
    key: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
    label: z.string().min(1).max(80),
  })).max(20).superRefine((list, ctx) => {
    const seen = new Set<string>();
    for (const d of list) {
      if (seen.has(d.key)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate key' });
      seen.add(d.key);
    }
  }),
  customFields: z.array(z.object({
    key: z.string().min(1).max(40).regex(/^[a-zA-Z0-9_-]+$/),
    label: z.string().min(1).max(80),
    type: z.enum(['text','textarea','select','checkbox']),
    required: z.boolean().default(false),
    options: z.array(z.string()).optional(),
  })).max(30),
  requireReceipt: z.boolean(),
  termsBodyHtml: z.string().max(20_000),
  marketingOptInLabel: z.string().max(200).optional(),
  completeRedirectUrl: z.string().url().nullable(),
});

export type FormSettings = z.infer<typeof FormSettingsSchema>;

export function defaultFormSettings(): FormSettings {
  return {
    amountPresets: [10000, 30000, 50000, 100000],
    allowCustomAmount: true,
    donationTypes: ['regular','onetime'],
    paymentMethods: ['card','cms','naverpay','kakaopay','virtual'],
    designations: [],
    customFields: [],
    requireReceipt: false,
    termsBodyHtml: '',
    completeRedirectUrl: null,
  };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/campaign-builder/form-settings-schema.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/form-settings/schema.ts tests/campaign-builder/form-settings-schema.test.ts
git commit -m "feat(builder): form_settings zod schema with defaults"
```

---

## Task 9: Preview token utility

**Files:**
- Create: `src/lib/campaign-builder/preview-token.ts`
- Test: `tests/campaign-builder/preview-token.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Write implementation**

```ts
// src/lib/campaign-builder/preview-token.ts
import { randomBytes, timingSafeEqual } from 'node:crypto';

export function generatePreviewToken(): string {
  return randomBytes(16).toString('base64url');
}
export function verifyPreviewToken(stored: string | null | undefined, provided: string | null | undefined): boolean {
  if (!stored || !provided) return false;
  const a = Buffer.from(stored); const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/campaign-builder/preview-token.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/preview-token.ts tests/campaign-builder/preview-token.test.ts
git commit -m "feat(builder): preview token generator with timing-safe verify"
```

---

## Task 10: Publish utility

**Files:**
- Create: `src/lib/campaign-builder/publish.ts`
- Test: `tests/integration/campaign-builder/publish.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { publishCampaign } from '@/lib/campaign-builder/publish';
import { createAdminClient } from '@/lib/supabase/admin';

describe('publishCampaign', () => {
  it('copies page_content to published_content', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').insert({
      title: 'T', slug: `t-${Date.now()}`,
      page_content: { meta:{schemaVersion:1}, blocks:[{ id:'1', type:'richText', props:{ html:'<p>x</p>' } }] },
    }).select().single();
    const res = await publishCampaign(c!.id);
    expect(res.ok).toBe(true);
    const { data: after } = await sb.from('campaigns').select('*').eq('id', c!.id).single();
    expect(after!.published_content).toEqual(after!.page_content);
    expect(after!.published_at).not.toBeNull();
  });
  it('rejects invalid page_content', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').insert({
      title: 'Bad', slug: `bad-${Date.now()}`,
      page_content: { meta:{}, blocks:[] },
    }).select().single();
    expect((await publishCampaign(c!.id)).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Write implementation**

```ts
// src/lib/campaign-builder/publish.ts
import { createAdminClient } from '@/lib/supabase/admin';
import { PageContentSchema } from './blocks/schema';
import { revalidateTag } from 'next/cache';

export async function publishCampaign(campaignId: string): Promise<{ ok: boolean; error?: string }> {
  const sb = createAdminClient();
  const { data: c, error } = await sb.from('campaigns').select('id, slug, page_content').eq('id', campaignId).single();
  if (error || !c) return { ok: false, error: 'campaign not found' };
  const parsed = PageContentSchema.safeParse(c.page_content);
  if (!parsed.success) return { ok: false, error: 'invalid page_content' };
  const { error: updErr } = await sb.from('campaigns').update({
    published_content: parsed.data,
    published_at: new Date().toISOString(),
    status: 'published',
  }).eq('id', campaignId);
  if (updErr) return { ok: false, error: updErr.message };
  revalidateTag(`campaign:${c.slug}`);
  return { ok: true };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/integration/campaign-builder/publish.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/publish.ts tests/integration/campaign-builder/publish.test.ts
git commit -m "feat(builder): publish copies draft→published with zod validation"
```

---

## Task 11: Assets library (upload guard + SVG sanitize)

**Files:**
- Create: `src/lib/campaign-builder/assets.ts`
- Test: `tests/campaign-builder/assets.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Write implementation**

```ts
// src/lib/campaign-builder/assets.ts
import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_MIME = new Set(['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']);
const MAX_BYTES = 5_242_880;

export function validateAssetUpload(input: { mimeType: string; sizeBytes: number }): { ok: boolean; error?: string } {
  if (!ALLOWED_MIME.has(input.mimeType)) return { ok: false, error: 'mime not allowed' };
  if (input.sizeBytes <= 0 || input.sizeBytes > MAX_BYTES) return { ok: false, error: 'size out of range' };
  return { ok: true };
}
export function sanitizeSvg(svg: string): string {
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: true } });
}
export function buildStoragePath(orgId: string, ext: string): string {
  const yyyyMm = new Date().toISOString().slice(0, 7);
  const uuid = crypto.randomUUID();
  return `${orgId}/${yyyyMm}/${uuid}.${ext.replace(/^\./,'')}`;
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/campaign-builder/assets.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/assets.ts tests/campaign-builder/assets.test.ts
git commit -m "feat(builder): asset upload guard + SVG sanitize"
```

---

## Task 12: Fundraising progress aggregation

**Files:**
- Create: `src/lib/campaign-builder/progress.ts`
- Test: `tests/integration/campaign-builder/progress.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';
import { createAdminClient } from '@/lib/supabase/admin';

describe('getCampaignProgress', () => {
  it('sums completed payments and returns percent', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').insert({ title:'P', slug:`p-${Date.now()}`, goal_amount: 100000 }).select().single();
    await sb.from('payments').insert([
      { campaign_id: c!.id, org_id: c!.org_id, amount: 30000, pay_status: 'completed' },
      { campaign_id: c!.id, org_id: c!.org_id, amount: 20000, pay_status: 'completed' },
      { campaign_id: c!.id, org_id: c!.org_id, amount: 99999, pay_status: 'failed' },
    ]);
    const p = await getCampaignProgress(c!.slug);
    expect(p.raised).toBe(50000);
    expect(p.percent).toBe(50);
  });
});
```

- [ ] **Step 2: Write implementation**

```ts
// src/lib/campaign-builder/progress.ts
import { createAdminClient } from '@/lib/supabase/admin';

export type CampaignProgress = {
  raised: number; donorCount: number; goal: number; percent: number; endDate: string | null;
};

export async function getCampaignProgress(slug: string): Promise<CampaignProgress> {
  const sb = createAdminClient();
  const { data: c } = await sb.from('campaigns').select('id, goal_amount, end_date').eq('slug', slug).single();
  if (!c) return { raised:0, donorCount:0, goal:0, percent:0, endDate:null };
  const { data: payments } = await sb
    .from('payments').select('amount, member_id').eq('campaign_id', c.id).eq('pay_status', 'completed');
  const raised = (payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0);
  const donorCount = new Set((payments ?? []).map(p => p.member_id ?? '')).size;
  const goal = c.goal_amount ?? 0;
  const percent = goal > 0 ? Math.min(100, Math.floor((raised / goal) * 100)) : 0;
  return { raised, donorCount, goal, percent, endDate: c.end_date ?? null };
}
```

- [ ] **Step 3: Run tests**

Run: `npm test -- tests/integration/campaign-builder/progress.test.ts`

- [ ] **Step 4: Commit**

```bash
git add src/lib/campaign-builder/progress.ts tests/integration/campaign-builder/progress.test.ts
git commit -m "feat(builder): fundraising progress aggregation query"
```

---

## Task 13: API — PATCH page-content

**Files:**
- Create: `src/app/api/admin/campaigns/[id]/page-content/route.ts`
- Create: `tests/integration/helpers/api.ts` (test harness — `buildAuthedRequest`, `buildAuthedFormRequest`, `createTestCampaign`)
- Test: `tests/integration/campaign-builder/api-page-content.test.ts`

- [ ] **Step 1: Write helper (follow existing integration-test pattern in repo)**

`tests/integration/helpers/api.ts` provides: `buildAuthedRequest(method, url, jsonBody, {org?})`, `buildAuthedFormRequest`, and `createTestCampaign(options)` returning `{ id, org_id, assetId? }`. Look at existing tests under `tests/integration/` (e.g. receipts, donations) and adapt the same harness.

- [ ] **Step 2: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { PATCH } from '@/app/api/admin/campaigns/[id]/page-content/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';

describe('PATCH page-content', () => {
  it('saves valid page_content', async () => {
    const { id } = await createTestCampaign();
    const body = { meta:{schemaVersion:1}, blocks:[{ id:'1', type:'richText', props:{ html:'<p>ok</p>' } }] };
    const req = await buildAuthedRequest('PATCH', `/api/admin/campaigns/${id}/page-content`, body);
    const res = await PATCH(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
  });
  it('rejects invalid block', async () => {
    const { id } = await createTestCampaign();
    const req = await buildAuthedRequest('PATCH', `/api/admin/campaigns/${id}/page-content`, { meta:{schemaVersion:1}, blocks:[{ id:'1', type:'unknown', props:{} }] });
    const res = await PATCH(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(400);
  });
  it('blocks cross-org', async () => {
    const { id } = await createTestCampaign({ org: 'A' });
    const req = await buildAuthedRequest('PATCH', `/api/admin/campaigns/${id}/page-content`, { meta:{schemaVersion:1}, blocks:[] }, { org: 'B' });
    const res = await PATCH(req, { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(403);
  });
});
```

- [ ] **Step 3: Write route**

```ts
// src/app/api/admin/campaigns/[id]/page-content/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { PageContentSchema } from '@/lib/campaign-builder/blocks/schema';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  if (!member) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const { data: campaign } = await sb.from('campaigns').select('org_id').eq('id', id).single();
  if (!campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = PageContentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.flatten() }, { status: 400 });

  const { error } = await sb.from('campaigns').update({ page_content: parsed.data }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ orgId: member.org_id, actorId: member.id, action: 'campaign.page_edit', targetId: id });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/integration/campaign-builder/api-page-content.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/campaigns/[id]/page-content/route.ts tests/integration/campaign-builder/api-page-content.test.ts tests/integration/helpers/api.ts
git commit -m "feat(builder): PATCH /api/admin/campaigns/[id]/page-content"
```

---

## Task 14: API — PATCH form-settings

**Files:**
- Create: `src/app/api/admin/campaigns/[id]/form-settings/route.ts`
- Test: `tests/integration/campaign-builder/api-form-settings.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { PATCH } from '@/app/api/admin/campaigns/[id]/form-settings/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

describe('PATCH form-settings', () => {
  it('saves valid', async () => {
    const { id } = await createTestCampaign();
    const res = await PATCH(await buildAuthedRequest('PATCH', `/api/admin/campaigns/${id}/form-settings`, defaultFormSettings()), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
  });
  it('rejects invalid', async () => {
    const { id } = await createTestCampaign();
    const res = await PATCH(await buildAuthedRequest('PATCH', `/api/admin/campaigns/${id}/form-settings`, { ...defaultFormSettings(), paymentMethods: ['bitcoin'] }), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Write route**

```ts
// src/app/api/admin/campaigns/[id]/form-settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { FormSettingsSchema } from '@/lib/campaign-builder/form-settings/schema';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  const { data: campaign } = await sb.from('campaigns').select('org_id').eq('id', id).single();
  if (!member || !campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const parsed = FormSettingsSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid', issues: parsed.error.flatten() }, { status: 400 });

  const { error } = await sb.from('campaigns').update({ form_settings: parsed.data }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await logAudit({ orgId: member.org_id, actorId: member.id, action: 'campaign.form_settings_edit', targetId: id });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Run tests + commit**

Run: `npm test -- tests/integration/campaign-builder/api-form-settings.test.ts`

```bash
git add src/app/api/admin/campaigns/[id]/form-settings/route.ts tests/integration/campaign-builder/api-form-settings.test.ts
git commit -m "feat(builder): PATCH /api/admin/campaigns/[id]/form-settings"
```

---

## Task 15: API — POST publish

**Files:**
- Create: `src/app/api/admin/campaigns/[id]/publish/route.ts`
- Test: `tests/integration/campaign-builder/api-publish.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/publish/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';
import { createAdminClient } from '@/lib/supabase/admin';

describe('POST publish', () => {
  it('copies page_content to published_content', async () => {
    const sb = createAdminClient();
    const { id } = await createTestCampaign({
      page_content: { meta:{schemaVersion:1}, blocks:[{ id:'1', type:'richText', props:{ html:'<p>hi</p>' } }] },
    });
    const res = await POST(await buildAuthedRequest('POST', `/api/admin/campaigns/${id}/publish`, {}), { params: Promise.resolve({ id }) } as any);
    expect(res.status).toBe(200);
    const { data } = await sb.from('campaigns').select('published_content, published_at, status').eq('id', id).single();
    expect(data!.published_at).not.toBeNull();
    expect(data!.status).toBe('published');
  });
});
```

- [ ] **Step 2: Write route**

```ts
// src/app/api/admin/campaigns/[id]/publish/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { publishCampaign } from '@/lib/campaign-builder/publish';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  const { data: campaign } = await sb.from('campaigns').select('org_id').eq('id', id).single();
  if (!member || !campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const r = await publishCampaign(id);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });
  await logAudit({ orgId: member.org_id, actorId: member.id, action: 'campaign.publish', targetId: id });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Run tests + commit**

Run: `npm test -- tests/integration/campaign-builder/api-publish.test.ts`

```bash
git add src/app/api/admin/campaigns/[id]/publish/route.ts tests/integration/campaign-builder/api-publish.test.ts
git commit -m "feat(builder): POST /api/admin/campaigns/[id]/publish"
```

---

## Task 16: API — preview-token

**Files:**
- Create: `src/app/api/admin/campaigns/[id]/preview-token/route.ts`
- Test: `tests/integration/campaign-builder/api-preview-token.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/preview-token/route';
import { buildAuthedRequest, createTestCampaign } from '../helpers/api';

describe('preview-token', () => {
  it('generates and rotates', async () => {
    const { id } = await createTestCampaign();
    const r1 = await POST(await buildAuthedRequest('POST', `/api/admin/campaigns/${id}/preview-token`, {}), { params: Promise.resolve({ id }) } as any);
    const b1 = await r1.json();
    expect(b1.token).toMatch(/^[A-Za-z0-9_-]{22,}$/);
    const r2 = await POST(await buildAuthedRequest('POST', `/api/admin/campaigns/${id}/preview-token`, {}), { params: Promise.resolve({ id }) } as any);
    const b2 = await r2.json();
    expect(b2.token).not.toBe(b1.token);
  });
});
```

- [ ] **Step 2: Write route**

```ts
// src/app/api/admin/campaigns/[id]/preview-token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { generatePreviewToken } from '@/lib/campaign-builder/preview-token';
import { createServerClient } from '@/lib/supabase/server';

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  const { data: campaign } = await sb.from('campaigns').select('org_id').eq('id', id).single();
  if (!member || !campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const token = generatePreviewToken();
  const { error } = await sb.from('campaigns').update({ preview_token: token }).eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ token });
}
```

- [ ] **Step 3: Run tests + commit**

Run: `npm test -- tests/integration/campaign-builder/api-preview-token.test.ts`

```bash
git add src/app/api/admin/campaigns/[id]/preview-token/route.ts tests/integration/campaign-builder/api-preview-token.test.ts
git commit -m "feat(builder): preview-token endpoint"
```

---

## Task 17: API — assets upload/delete

**Files:**
- Create: `src/app/api/admin/campaigns/[id]/assets/route.ts`
- Create: `src/app/api/admin/campaigns/[id]/assets/[assetId]/route.ts`
- Test: `tests/integration/campaign-builder/api-assets.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/admin/campaigns/[id]/assets/route';
import { DELETE } from '@/app/api/admin/campaigns/[id]/assets/[assetId]/route';
import { buildAuthedFormRequest, buildAuthedRequest, createTestCampaign } from '../helpers/api';

describe('assets', () => {
  it('uploads png and rejects pdf', async () => {
    const { id } = await createTestCampaign();
    const png = new File([new Uint8Array([0x89,0x50,0x4e,0x47])], 't.png', { type: 'image/png' });
    const ok = await POST(await buildAuthedFormRequest('POST', `/api/admin/campaigns/${id}/assets`, { file: png }), { params: Promise.resolve({ id }) } as any);
    expect(ok.status).toBe(200);
    const pdf = new File([new Uint8Array([0x25,0x50])], 't.pdf', { type: 'application/pdf' });
    const bad = await POST(await buildAuthedFormRequest('POST', `/api/admin/campaigns/${id}/assets`, { file: pdf }), { params: Promise.resolve({ id }) } as any);
    expect(bad.status).toBe(400);
  });
  it('rejects delete when referenced', async () => {
    const { id, assetId } = await createTestCampaign({ withReferencedAsset: true });
    const res = await DELETE(await buildAuthedRequest('DELETE', `/api/admin/campaigns/${id}/assets/${assetId}`, {}), { params: Promise.resolve({ id, assetId }) } as any);
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Write routes**

```ts
// src/app/api/admin/campaigns/[id]/assets/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateAssetUpload, buildStoragePath, sanitizeSvg } from '@/lib/campaign-builder/assets';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  const { data: campaign } = await sb.from('campaigns').select('org_id').eq('id', id).single();
  if (!member || !campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'file required' }, { status: 400 });
  const v = validateAssetUpload({ mimeType: file.type, sizeBytes: file.size });
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  let bytes = new Uint8Array(await file.arrayBuffer());
  if (file.type === 'image/svg+xml') {
    bytes = new TextEncoder().encode(sanitizeSvg(new TextDecoder().decode(bytes)));
  }
  const ext = (file.name.split('.').pop() ?? 'bin').toLowerCase();
  const path = buildStoragePath(member.org_id, ext);
  const up = await sb.storage.from('campaign-assets').upload(path, bytes, { contentType: file.type, upsert: false });
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  const { data: pub } = sb.storage.from('campaign-assets').getPublicUrl(path);
  const ins = await sb.from('campaign_assets').insert({
    org_id: member.org_id, campaign_id: id, storage_path: path, public_url: pub.publicUrl,
    mime_type: file.type, size_bytes: file.size, created_by: member.id,
  }).select().single();
  if (ins.error) return NextResponse.json({ error: ins.error.message }, { status: 500 });
  await logAudit({ orgId: member.org_id, actorId: member.id, action: 'campaign.asset_upload', targetId: ins.data.id });
  return NextResponse.json({ asset: ins.data });
}
```

```ts
// src/app/api/admin/campaigns/[id]/assets/[assetId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string; assetId: string }> }) {
  const { id, assetId } = await ctx.params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
  const { data: campaign } = await sb.from('campaigns').select('org_id, page_content, published_content').eq('id', id).single();
  if (!member || !campaign || campaign.org_id !== member.org_id) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const blob = JSON.stringify(campaign.page_content) + JSON.stringify(campaign.published_content);
  if (blob.includes(`"${assetId}"`)) return NextResponse.json({ error: 'asset is referenced' }, { status: 409 });
  const { data: asset } = await sb.from('campaign_assets').select('storage_path').eq('id', assetId).single();
  if (asset) await sb.storage.from('campaign-assets').remove([asset.storage_path]);
  await sb.from('campaign_assets').delete().eq('id', assetId);
  await logAudit({ orgId: member.org_id, actorId: member.id, action: 'campaign.asset_delete', targetId: assetId });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Run tests + commit**

Run: `npm test -- tests/integration/campaign-builder/api-assets.test.ts`

```bash
git add src/app/api/admin/campaigns/[id]/assets tests/integration/campaign-builder/api-assets.test.ts
git commit -m "feat(builder): asset upload + reference-guarded delete"
```

---

## Task 18: Public progress API

**Files:**
- Create: `src/app/api/public/campaigns/[slug]/progress/route.ts`

- [ ] **Step 1: Write route**

```ts
// src/app/api/public/campaigns/[slug]/progress/route.ts
import { NextResponse } from 'next/server';
import { getCampaignProgress } from '@/lib/campaign-builder/progress';

export const revalidate = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const p = await getCampaignProgress(slug);
  return NextResponse.json(p, { headers: { 'Cache-Tag': `campaign:${slug}` } });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/public/campaigns/[slug]/progress/route.ts
git commit -m "feat(builder): public progress endpoint with ISR tag"
```

---

## Task 19: 8 block components + BlockRenderer

**Files:**
- Create: `src/lib/campaign-builder/blocks/registry.tsx`
- Create files under `src/components/campaign-blocks/`
- Test: `tests/campaign-builder/block-renderer.test.tsx`

- [ ] **Step 1: Write failing test**

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BlockRenderer } from '@/components/campaign-blocks/BlockRenderer';

describe('BlockRenderer', () => {
  it('renders richText sanitized', () => {
    const { container } = render(<BlockRenderer
      content={{ meta:{schemaVersion:1}, blocks:[{ id:'1', type:'richText', props:{ html:'<p>hi</p><script>alert(1)</script>' } }] }}
      slug="t"
    />);
    expect(container.innerHTML).toContain('<p>hi</p>');
    expect(container.innerHTML).not.toContain('<script>');
  });
  it('skips unknown type', () => {
    const { container } = render(<BlockRenderer
      content={{ meta:{schemaVersion:1}, blocks:[{ id:'1', type:'future', props:{} } as any] }}
      slug="t"
    />);
    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 2: Write BlockRenderer + components**

```tsx
// src/components/campaign-blocks/BlockRenderer.tsx
import React from 'react';
import { blockRegistry } from '@/lib/campaign-builder/blocks/registry';
import type { PageContent } from '@/lib/campaign-builder/blocks/schema';

export function BlockRenderer({ content, slug }: { content: PageContent; slug: string }) {
  if (!content?.blocks) return null;
  return <>{content.blocks.map((b) => {
    const Comp = blockRegistry[b.type];
    if (!Comp) return null;
    return <Comp key={b.id} block={b as any} slug={slug} />;
  })}</>;
}
```

```tsx
// src/components/campaign-blocks/RichText.tsx
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';
export function RichText({ block }: { block: { props: { html: string } } }) {
  const clean = sanitizeHtml(block.props.html);
  // SECURITY: `clean` has been passed through DOMPurify via sanitizeHtml(); raw input never reaches the DOM.
  return <div className="prose prose-neutral mx-auto max-w-3xl px-4 py-8" dangerouslySetInnerHTML={{ __html: clean }} />;
}
```

```tsx
// src/components/campaign-blocks/Hero.tsx
import Image from 'next/image';
export function Hero({ block }: { block: { props: any } }) {
  const { backgroundImageAssetId, headline, subheadline, ctaLabel, ctaAnchorBlockId } = block.props;
  return (
    <section className="relative h-[70vh] min-h-[420px] w-full overflow-hidden">
      {backgroundImageAssetId ? <Image src={backgroundImageAssetId} alt="" fill priority className="object-cover" /> : null}
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-4 text-center text-white">
        <h1 className="text-4xl font-bold md:text-6xl">{headline}</h1>
        {subheadline ? <p className="mt-4 max-w-2xl text-lg">{subheadline}</p> : null}
        <a href={ctaAnchorBlockId ? `#${ctaAnchorBlockId}` : '#donate'} className="mt-8 rounded-full bg-white px-8 py-3 font-semibold text-black">{ctaLabel}</a>
      </div>
    </section>
  );
}
```

```tsx
// src/components/campaign-blocks/ImageSingle.tsx
import Image from 'next/image';
export function ImageSingle({ block }: { block: { props: any } }) {
  const { assetId, altText, caption, linkUrl } = block.props;
  const img = assetId ? <Image src={assetId} alt={altText} width={1200} height={800} className="h-auto w-full rounded-lg" /> : null;
  return (
    <figure className="mx-auto my-8 max-w-3xl px-4">
      {linkUrl ? <a href={linkUrl}>{img}</a> : img}
      {caption ? <figcaption className="mt-2 text-center text-sm text-neutral-500">{caption}</figcaption> : null}
    </figure>
  );
}
```

```tsx
// src/components/campaign-blocks/ImpactStats.tsx
import { Heart, Users, Globe, Home, Book, Utensils, Droplet, Shield } from 'lucide-react';
const icons = { heart: Heart, users: Users, globe: Globe, home: Home, book: Book, utensils: Utensils, droplet: Droplet, shield: Shield };
export function ImpactStats({ block }: { block: { props: any } }) {
  const { heading, items } = block.props;
  return (
    <section className="mx-auto my-12 max-w-5xl px-4">
      {heading ? <h2 className="mb-8 text-center text-3xl font-bold">{heading}</h2> : null}
      <div className="grid grid-cols-2 gap-6 md:grid-cols-3">
        {items.map((it: any, i: number) => {
          const I = (icons as any)[it.icon] ?? Heart;
          return (
            <div key={i} className="flex flex-col items-center rounded-lg bg-neutral-50 p-6 text-center">
              <I className="mb-3 h-8 w-8 text-rose-500" />
              <div className="text-2xl font-bold">{it.value}</div>
              <div className="mt-1 text-sm text-neutral-600">{it.label}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

```tsx
// src/components/campaign-blocks/FundraisingProgress.tsx
import { getCampaignProgress } from '@/lib/campaign-builder/progress';
export async function FundraisingProgress({ block, slug }: { block: { props: any }; slug: string }) {
  const p = await getCampaignProgress(slug);
  const daysLeft = p.endDate ? Math.max(0, Math.ceil((new Date(p.endDate).getTime() - Date.now()) / 86400000)) : null;
  return (
    <section className="mx-auto my-8 max-w-3xl px-4">
      <div className="mb-2 flex justify-between text-sm">
        <span>{p.raised.toLocaleString()}원 모금</span>
        <span>{p.percent}%</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-neutral-200">
        <div className="h-full bg-rose-500" style={{ width: `${p.percent}%` }} />
      </div>
      <div className="mt-3 flex gap-6 text-sm text-neutral-600">
        {block.props.showDonorCount ? <span>{p.donorCount.toLocaleString()}명 참여</span> : null}
        {block.props.showDDay && daysLeft !== null ? <span>D-{daysLeft}</span> : null}
      </div>
    </section>
  );
}
```

```tsx
// src/components/campaign-blocks/Faq.tsx
'use client';
import { Accordion } from '@base-ui-components/react';
export function Faq({ block }: { block: { props: any } }) {
  return (
    <section className="mx-auto my-12 max-w-3xl px-4">
      {block.props.heading ? <h2 className="mb-6 text-2xl font-bold">{block.props.heading}</h2> : null}
      <Accordion.Root>
        {block.props.items.map((it: any, i: number) => (
          <Accordion.Item key={i} value={String(i)} className="border-b">
            <Accordion.Header>
              <Accordion.Trigger className="flex w-full justify-between py-4 text-left font-medium">{it.question}</Accordion.Trigger>
            </Accordion.Header>
            <Accordion.Panel className="pb-4 text-neutral-700">{it.answer}</Accordion.Panel>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </section>
  );
}
```

```tsx
// src/components/campaign-blocks/DonationQuickForm.tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function DonationQuickForm({ block, slug, formSettings }: { block: any; slug: string; formSettings: any }) {
  const r = useRouter();
  const [type, setType] = useState(formSettings.donationTypes[0]);
  const [amount, setAmount] = useState(formSettings.amountPresets[0]);
  const [designation, setDesignation] = useState<string | undefined>(formSettings.designations[0]?.key);
  return (
    <section id="donate" className="mx-auto my-12 max-w-xl rounded-xl bg-white p-6 shadow-lg">
      {block.props.heading ? <h2 className="mb-4 text-2xl font-bold">{block.props.heading}</h2> : null}
      <div className="mb-4 flex gap-2">
        {formSettings.donationTypes.map((t: string) => (
          <button key={t} onClick={() => setType(t)} className={`flex-1 rounded-full px-4 py-2 ${type === t ? 'bg-rose-500 text-white' : 'bg-neutral-100'}`}>
            {t === 'regular' ? '정기' : '일시'}
          </button>
        ))}
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {formSettings.amountPresets.map((a: number) => (
          <button key={a} onClick={() => setAmount(a)} className={`rounded-lg border px-3 py-2 ${amount === a ? 'border-rose-500 bg-rose-50' : ''}`}>
            {a.toLocaleString()}원
          </button>
        ))}
      </div>
      {formSettings.allowCustomAmount ? (
        <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="mb-4 w-full rounded border px-3 py-2" />
      ) : null}
      {block.props.showDesignation && formSettings.designations.length > 0 ? (
        <select value={designation} onChange={e => setDesignation(e.target.value)} className="mb-4 w-full rounded border px-3 py-2">
          {formSettings.designations.map((d: any) => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      ) : null}
      <button onClick={() => {
        const q = new URLSearchParams({ campaign: slug, type, amount: String(amount) });
        if (designation) q.set('designation', designation);
        r.push(`/donate/wizard?${q.toString()}`);
      }} className="w-full rounded-full bg-rose-500 py-3 font-semibold text-white">후원하기</button>
    </section>
  );
}
```

```tsx
// src/components/campaign-blocks/SnsShare.tsx
'use client';
export function SnsShare({ block }: { block: { props: any } }) {
  return (
    <section className="my-8 flex justify-center gap-3">
      {block.props.channels.includes('facebook') ? (
        <a target="_blank" rel="noopener" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(typeof window !== 'undefined' ? location.href : '')}`} className="rounded-full bg-blue-600 px-5 py-2 text-white">페이스북</a>
      ) : null}
      {block.props.channels.includes('kakao') ? (
        <button onClick={() => (window as any).Kakao?.Share?.sendDefault?.({ objectType: 'feed' })} className="rounded-full bg-yellow-400 px-5 py-2">카카오톡</button>
      ) : null}
      {block.props.channels.includes('link') ? (
        <button onClick={() => navigator.clipboard.writeText(location.href)} className="rounded-full bg-neutral-200 px-5 py-2">링크 복사</button>
      ) : null}
    </section>
  );
}
```

```tsx
// src/lib/campaign-builder/blocks/registry.tsx
import { Hero } from '@/components/campaign-blocks/Hero';
import { RichText } from '@/components/campaign-blocks/RichText';
import { ImageSingle } from '@/components/campaign-blocks/ImageSingle';
import { ImpactStats } from '@/components/campaign-blocks/ImpactStats';
import { FundraisingProgress } from '@/components/campaign-blocks/FundraisingProgress';
import { Faq } from '@/components/campaign-blocks/Faq';
import { DonationQuickForm } from '@/components/campaign-blocks/DonationQuickForm';
import { SnsShare } from '@/components/campaign-blocks/SnsShare';
import { createAdminClient } from '@/lib/supabase/admin';

async function DonationQuickFormWithSettings({ block, slug }: { block: any; slug: string }) {
  const sb = createAdminClient();
  const { data } = await sb.from('campaigns').select('form_settings').eq('slug', slug).single();
  return <DonationQuickForm block={block} slug={slug} formSettings={data?.form_settings ?? {}} />;
}

export const blockRegistry: Record<string, any> = {
  hero: Hero, richText: RichText, imageSingle: ImageSingle, impactStats: ImpactStats,
  fundraisingProgress: FundraisingProgress, faq: Faq,
  donationQuickForm: DonationQuickFormWithSettings, snsShare: SnsShare,
};
```

- [ ] **Step 3: Run tests + commit**

Run: `npm test -- tests/campaign-builder/block-renderer.test.tsx`

```bash
git add src/lib/campaign-builder/blocks/registry.tsx src/components/campaign-blocks/ tests/campaign-builder/block-renderer.test.tsx
git commit -m "feat(builder): 8 block components + sanitized BlockRenderer"
```

---

## Task 20: Public campaign page uses BlockRenderer

**Files:**
- Modify: `src/app/(public)/campaigns/[slug]/page.tsx`

- [ ] **Step 1: Read current page**

Run: `cat "src/app/(public)/campaigns/[slug]/page.tsx"`

- [ ] **Step 2: Replace body**

```tsx
// src/app/(public)/campaigns/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { BlockRenderer } from '@/components/campaign-blocks/BlockRenderer';
import { PageContentSchema } from '@/lib/campaign-builder/blocks/schema';

export const revalidate = 60;

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sb = createAdminClient();
  const { data: c } = await sb
    .from('campaigns')
    .select('id, slug, title, published_content, form_settings, status, end_date')
    .eq('slug', slug).single();
  if (!c || c.status !== 'published') notFound();
  const parsed = PageContentSchema.safeParse(c.published_content);
  if (!parsed.success) notFound();
  if (c.end_date && new Date(c.end_date) < new Date()) {
    return <main className="mx-auto max-w-xl p-10 text-center">캠페인이 종료되었습니다.</main>;
  }
  return <main><BlockRenderer content={parsed.data} slug={slug} /></main>;
}
```

- [ ] **Step 3: Smoke run + commit**

Run: `npm run dev`, open `/campaigns/<existing-slug>`
Expected: backfilled richText block renders.

```bash
git add "src/app/(public)/campaigns/[slug]/page.tsx"
git commit -m "feat(builder): public campaign page renders via BlockRenderer"
```

---

## Task 21: Preview route with token verification

**Files:**
- Create: `src/app/(public)/campaigns/[slug]/preview/page.tsx`

- [ ] **Step 1: Write page**

```tsx
// src/app/(public)/campaigns/[slug]/preview/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/admin';
import { BlockRenderer } from '@/components/campaign-blocks/BlockRenderer';
import { PageContentSchema } from '@/lib/campaign-builder/blocks/schema';
import { verifyPreviewToken } from '@/lib/campaign-builder/preview-token';

export const metadata: Metadata = { robots: 'noindex,nofollow' };
export const revalidate = 0;

export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ token?: string }> }) {
  const { slug } = await params;
  const { token } = await searchParams;
  const sb = createAdminClient();
  const { data: c } = await sb.from('campaigns').select('slug, preview_token, page_content').eq('slug', slug).single();
  if (!c || !verifyPreviewToken(c.preview_token, token ?? null)) notFound();
  const parsed = PageContentSchema.safeParse(c.page_content);
  if (!parsed.success) notFound();
  return (
    <main>
      <div className="bg-yellow-100 py-2 text-center text-sm">미리보기 — 공개 전 상태</div>
      <BlockRenderer content={parsed.data} slug={slug} />
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add "src/app/(public)/campaigns/[slug]/preview/page.tsx"
git commit -m "feat(builder): token-verified preview route renders draft"
```

---

## Task 22: Admin editor — shell + autosave

**Files:**
- Create: `src/app/(admin)/admin/campaigns/[id]/edit/page.tsx`
- Create: `src/components/campaign-builder/Editor.tsx`

- [ ] **Step 1: Install deps**

Run: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities @tiptap/react @tiptap/starter-kit react-hook-form @hookform/resolvers`

- [ ] **Step 2: Write server page**

```tsx
// src/app/(admin)/admin/campaigns/[id]/edit/page.tsx
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { Editor } from '@/components/campaign-builder/Editor';
import { defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await createServerClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/admin/login');
  const { data: member } = await sb.from('members').select('org_id').eq('id', user.id).single();
  const { data: c } = await sb.from('campaigns').select('*').eq('id', id).single();
  if (!c || !member || c.org_id !== member.org_id) redirect('/admin/campaigns');
  return <Editor initial={{
    id: c.id, slug: c.slug, title: c.title,
    pageContent: c.page_content,
    formSettings: { ...defaultFormSettings(), ...(c.form_settings ?? {}) },
  }} />;
}
```

- [ ] **Step 3: Write Editor**

```tsx
// src/components/campaign-builder/Editor.tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { Palette } from './Palette';
import { Canvas } from './Canvas';
import { PropsPanel } from './PropsPanel';
import type { PageContent, Block } from '@/lib/campaign-builder/blocks/schema';

export function Editor({ initial }: { initial: { id: string; slug: string; title: string; pageContent: PageContent; formSettings: any } }) {
  const [content, setContent] = useState<PageContent>(initial.pageContent);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle'|'saving'|'saved'|'error'>('idle');
  const [viewport, setViewport] = useState<'mobile'|'desktop'>('desktop');
  const timer = useRef<NodeJS.Timeout | null>(null);
  const firstRun = useRef(true);

  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    setSaveState('saving');
    timer.current = setTimeout(async () => {
      const res = await fetch(`/api/admin/campaigns/${initial.id}/page-content`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(content),
      });
      setSaveState(res.ok ? 'saved' : 'error');
    }, 2000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [content, initial.id]);

  const selected = content.blocks.find(b => b.id === selectedId) ?? null;

  async function onPreview() {
    const res = await fetch(`/api/admin/campaigns/${initial.id}/preview-token`, { method: 'POST' });
    const { token } = await res.json();
    window.open(`/campaigns/${initial.slug}/preview?token=${token}`, '_blank');
  }
  async function onPublish() {
    if (!confirm('발행하시겠습니까?')) return;
    const res = await fetch(`/api/admin/campaigns/${initial.id}/publish`, { method: 'POST' });
    alert(res.ok ? '발행 완료' : '발행 실패');
  }

  const width = viewport === 'mobile' ? 'max-w-[375px]' : 'max-w-[1280px]';

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-2">
        <div className="font-semibold">{initial.title}</div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">
            {saveState === 'saving' ? '저장 중…' : saveState === 'saved' ? '저장됨' : saveState === 'error' ? '저장 실패' : ''}
          </span>
          <button onClick={() => setViewport(viewport === 'mobile' ? 'desktop' : 'mobile')} className="rounded border px-3 py-1">
            {viewport === 'mobile' ? '데스크톱' : '모바일'}
          </button>
          <button onClick={onPreview} className="rounded border px-3 py-1">미리보기</button>
          <button onClick={onPublish} className="rounded bg-rose-500 px-3 py-1 text-white">발행</button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <Palette
          onAdd={(b) => setContent({ ...content, blocks: [...content.blocks, b] })}
          campaignId={initial.id}
          initialFormSettings={initial.formSettings}
        />
        <div className="flex-1 overflow-auto bg-neutral-100 p-6">
          <div className={`mx-auto ${width} bg-white shadow`}>
            <Canvas
              blocks={content.blocks}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onChange={(blocks) => setContent({ ...content, blocks })}
              campaignSlug={initial.slug}
            />
          </div>
        </div>
        <PropsPanel
          block={selected}
          campaignId={initial.id}
          onChange={(next) => setContent({ ...content, blocks: content.blocks.map(b => b.id === next.id ? next : b) })}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/campaigns/[id]/edit/page.tsx" src/components/campaign-builder/Editor.tsx package.json package-lock.json
git commit -m "feat(builder): admin editor shell with autosave, preview, publish"
```

---

## Task 23: Editor — Palette

**Files:**
- Create: `src/components/campaign-builder/Palette.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/campaign-builder/Palette.tsx
'use client';
import { useState } from 'react';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { FormSettingsPanel } from './form-settings/FormSettingsPanel';

const CATALOG: Array<{ type: Block['type']; label: string; defaults: () => any }> = [
  { type: 'hero', label: 'Hero', defaults: () => ({ backgroundImageAssetId:'', headline:'제목', subheadline:'', ctaLabel:'후원하기' }) },
  { type: 'richText', label: '텍스트', defaults: () => ({ html: '<p>내용을 입력하세요</p>' }) },
  { type: 'imageSingle', label: '이미지', defaults: () => ({ assetId:'', altText:'이미지' }) },
  { type: 'impactStats', label: '임팩트 통계', defaults: () => ({ items:[{ icon:'heart', value:'1,000', label:'명 지원' }] }) },
  { type: 'fundraisingProgress', label: '모금 현황', defaults: () => ({ showDonorCount:true, showDDay:false }) },
  { type: 'faq', label: 'FAQ', defaults: () => ({ items:[{ question:'질문', answer:'답변' }] }) },
  { type: 'donationQuickForm', label: '퀵 후원 폼', defaults: () => ({ showDesignation:false }) },
  { type: 'snsShare', label: 'SNS 공유', defaults: () => ({ channels:['kakao','facebook','link'] }) },
];

export function Palette({ onAdd, campaignId, initialFormSettings }: { onAdd: (b: Block) => void; campaignId: string; initialFormSettings: any }) {
  const [tab, setTab] = useState<'blocks'|'form'>('blocks');
  return (
    <aside className="w-60 shrink-0 border-r bg-white">
      <div className="flex border-b text-sm">
        <button onClick={() => setTab('blocks')} className={`flex-1 py-2 ${tab === 'blocks' ? 'border-b-2 border-rose-500 font-semibold' : ''}`}>블록</button>
        <button onClick={() => setTab('form')} className={`flex-1 py-2 ${tab === 'form' ? 'border-b-2 border-rose-500 font-semibold' : ''}`}>폼 설정</button>
      </div>
      {tab === 'blocks' ? (
        <div className="space-y-2 p-3">
          {CATALOG.map(c => (
            <button key={c.type}
              onClick={() => onAdd({ id: crypto.randomUUID(), type: c.type, props: c.defaults() } as Block)}
              className="w-full rounded border px-3 py-2 text-left text-sm hover:bg-neutral-50">
              + {c.label}
            </button>
          ))}
        </div>
      ) : (
        <FormSettingsPanel campaignId={campaignId} initial={initialFormSettings} />
      )}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-builder/Palette.tsx
git commit -m "feat(builder): editor palette + form-settings tab"
```

---

## Task 24: Editor — Canvas with sortable blocks

**Files:**
- Create: `src/components/campaign-builder/Canvas.tsx`
- Create: `src/components/campaign-builder/BlockToolbar.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/campaign-builder/BlockToolbar.tsx
'use client';
import { GripVertical, ArrowUp, ArrowDown, Copy, Trash2 } from 'lucide-react';
export function BlockToolbar({ dragHandleProps, onUp, onDown, onDup, onDel, canUp, canDown }: any) {
  return (
    <div className="absolute right-2 top-2 z-20 flex gap-1 rounded bg-white px-1 py-0.5 shadow">
      <button {...dragHandleProps} className="cursor-grab p-1"><GripVertical className="h-4 w-4" /></button>
      <button disabled={!canUp} onClick={onUp} className="p-1 disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
      <button disabled={!canDown} onClick={onDown} className="p-1 disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
      <button onClick={onDup} className="p-1"><Copy className="h-4 w-4" /></button>
      <button onClick={onDel} className="p-1 text-rose-500"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/Canvas.tsx
'use client';
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { blockRegistry } from '@/lib/campaign-builder/blocks/registry';
import { BlockToolbar } from './BlockToolbar';

export function Canvas({ blocks, selectedId, onSelect, onChange, campaignSlug }: {
  blocks: Block[]; selectedId: string | null; onSelect: (id: string) => void; onChange: (b: Block[]) => void; campaignSlug: string;
}) {
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = blocks.findIndex(b => b.id === active.id);
    const to = blocks.findIndex(b => b.id === over.id);
    onChange(arrayMove(blocks, from, to));
  }
  const remove = (id: string) => onChange(blocks.filter(b => b.id !== id));
  const duplicate = (id: string) => {
    const i = blocks.findIndex(b => b.id === id); if (i < 0) return;
    const clone = { ...blocks[i], id: crypto.randomUUID() };
    const next = [...blocks]; next.splice(i + 1, 0, clone as Block); onChange(next);
  };
  const moveBy = (id: string, d: number) => {
    const i = blocks.findIndex(b => b.id === id); const j = i + d;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    onChange(arrayMove(blocks, i, j));
  };
  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map(b => b.id)} strategy={verticalListSortingStrategy}>
        {blocks.map((b, idx) => (
          <SortableBlock key={b.id} block={b} idx={idx} total={blocks.length}
            selected={selectedId === b.id}
            onSelect={() => onSelect(b.id)}
            onRemove={() => remove(b.id)}
            onDuplicate={() => duplicate(b.id)}
            onUp={() => moveBy(b.id, -1)}
            onDown={() => moveBy(b.id, 1)}
            slug={campaignSlug}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

function SortableBlock({ block, idx, total, selected, onSelect, onRemove, onDuplicate, onUp, onDown, slug }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block.id });
  const Comp = blockRegistry[block.type];
  return (
    <div ref={setNodeRef}
         style={{ transform: CSS.Transform.toString(transform), transition }}
         onClick={onSelect}
         className={`relative border-2 ${selected ? 'border-rose-500' : 'border-transparent'} hover:border-rose-200`}>
      <BlockToolbar
        dragHandleProps={{ ...attributes, ...listeners }}
        canUp={idx > 0} canDown={idx < total - 1}
        onUp={onUp} onDown={onDown} onDup={onDuplicate} onDel={onRemove}
      />
      {Comp ? <Comp block={block} slug={slug} /> : null}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-builder/Canvas.tsx src/components/campaign-builder/BlockToolbar.tsx
git commit -m "feat(builder): sortable canvas with block toolbar"
```

---

## Task 25: Editor — PropsPanel + per-block forms + inputs

**Files:**
- Create: `src/components/campaign-builder/PropsPanel.tsx`
- Create: `src/components/campaign-builder/forms/*PropsForm.tsx` (8 files)
- Create: `src/components/campaign-builder/inputs/AssetUploadField.tsx`
- Create: `src/components/campaign-builder/inputs/RichTextField.tsx`

- [ ] **Step 1: Write PropsPanel**

```tsx
// src/components/campaign-builder/PropsPanel.tsx
'use client';
import type { Block } from '@/lib/campaign-builder/blocks/schema';
import { HeroPropsForm } from './forms/HeroPropsForm';
import { RichTextPropsForm } from './forms/RichTextPropsForm';
import { ImageSinglePropsForm } from './forms/ImageSinglePropsForm';
import { ImpactStatsPropsForm } from './forms/ImpactStatsPropsForm';
import { FundraisingProgressPropsForm } from './forms/FundraisingProgressPropsForm';
import { FaqPropsForm } from './forms/FaqPropsForm';
import { DonationQuickFormPropsForm } from './forms/DonationQuickFormPropsForm';
import { SnsSharePropsForm } from './forms/SnsSharePropsForm';

export function PropsPanel({ block, campaignId, onChange }: { block: Block | null; campaignId: string; onChange: (b: Block) => void }) {
  if (!block) return <aside className="w-80 shrink-0 border-l bg-white p-4 text-sm text-neutral-500">블록을 선택하세요</aside>;
  const common = { block, campaignId, onChange } as any;
  const Form =
    block.type === 'hero' ? HeroPropsForm :
    block.type === 'richText' ? RichTextPropsForm :
    block.type === 'imageSingle' ? ImageSinglePropsForm :
    block.type === 'impactStats' ? ImpactStatsPropsForm :
    block.type === 'fundraisingProgress' ? FundraisingProgressPropsForm :
    block.type === 'faq' ? FaqPropsForm :
    block.type === 'donationQuickForm' ? DonationQuickFormPropsForm :
    SnsSharePropsForm;
  return (
    <aside className="w-80 shrink-0 overflow-auto border-l bg-white p-4">
      <div className="mb-3 text-xs uppercase text-neutral-500">{block.type}</div>
      <Form {...common} />
    </aside>
  );
}
```

- [ ] **Step 2: Write inputs**

```tsx
// src/components/campaign-builder/inputs/AssetUploadField.tsx
'use client';
import { useState } from 'react';
export function AssetUploadField({ campaignId, value, onChange, label }: any) {
  const [busy, setBusy] = useState(false);
  async function upload(file: File) {
    setBusy(true);
    const fd = new FormData(); fd.append('file', file);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/assets`, { method: 'POST', body: fd });
    setBusy(false);
    if (!res.ok) return alert('업로드 실패');
    const { asset } = await res.json();
    onChange(asset.public_url);
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs">{label}</span>
      {value ? <img src={value} alt="" className="mb-2 max-h-28 w-full rounded object-cover" /> : null}
      <input type="file" accept="image/*" disabled={busy} onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
    </label>
  );
}
```

```tsx
// src/components/campaign-builder/inputs/RichTextField.tsx
'use client';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect } from 'react';

export function RichTextField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const editor = useEditor({ extensions: [StarterKit], content: value, onUpdate: ({ editor }) => onChange(editor.getHTML()) });
  useEffect(() => { if (editor && editor.getHTML() !== value) editor.commands.setContent(value); }, [value, editor]);
  return <div className="min-h-24 rounded border p-2"><EditorContent editor={editor} /></div>;
}
```

- [ ] **Step 3: Write 8 per-block form components**

Each file follows the same controlled-input pattern:

```tsx
// src/components/campaign-builder/forms/HeroPropsForm.tsx
'use client';
import { AssetUploadField } from '../inputs/AssetUploadField';
function TextInput({ label, value, onChange }: any) {
  return <label className="block"><span className="mb-1 block text-xs">{label}</span>
    <input className="w-full rounded border px-2 py-1" value={value ?? ''} onChange={e => onChange(e.target.value)} />
  </label>;
}
export function HeroPropsForm({ block, campaignId, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-3">
      <AssetUploadField campaignId={campaignId} value={p.backgroundImageAssetId} onChange={(url: string) => set({ backgroundImageAssetId: url })} label="배경 이미지" />
      <TextInput label="헤드라인" value={p.headline} onChange={(v: string) => set({ headline: v })} />
      <TextInput label="서브카피" value={p.subheadline} onChange={(v: string) => set({ subheadline: v })} />
      <TextInput label="CTA 버튼" value={p.ctaLabel} onChange={(v: string) => set({ ctaLabel: v })} />
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/RichTextPropsForm.tsx
'use client';
import { RichTextField } from '../inputs/RichTextField';
export function RichTextPropsForm({ block, onChange }: any) {
  return <RichTextField value={block.props.html} onChange={(html: string) => onChange({ ...block, props: { html } })} />;
}
```

```tsx
// src/components/campaign-builder/forms/ImageSinglePropsForm.tsx
'use client';
import { AssetUploadField } from '../inputs/AssetUploadField';
export function ImageSinglePropsForm({ block, campaignId, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-3">
      <AssetUploadField campaignId={campaignId} value={p.assetId} onChange={(url: string) => set({ assetId: url })} label="이미지" />
      <label className="block"><span className="mb-1 block text-xs">Alt 텍스트</span><input className="w-full rounded border px-2 py-1" value={p.altText ?? ''} onChange={e => set({ altText: e.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-xs">캡션</span><input className="w-full rounded border px-2 py-1" value={p.caption ?? ''} onChange={e => set({ caption: e.target.value })} /></label>
      <label className="block"><span className="mb-1 block text-xs">링크 URL</span><input className="w-full rounded border px-2 py-1" value={p.linkUrl ?? ''} onChange={e => set({ linkUrl: e.target.value })} /></label>
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/ImpactStatsPropsForm.tsx
'use client';
const ICONS = ['heart','users','globe','home','book','utensils','droplet','shield'];
export function ImpactStatsPropsForm({ block, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-2">
      <label className="block"><span className="mb-1 block text-xs">제목</span>
        <input className="w-full rounded border px-2 py-1" value={p.heading ?? ''} onChange={e => set({ heading: e.target.value })} />
      </label>
      {p.items.map((it: any, i: number) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <select className="w-full rounded border px-1" value={it.icon} onChange={e => { const items = [...p.items]; items[i] = { ...it, icon: e.target.value }; set({ items }); }}>
            {ICONS.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <input className="w-full rounded border px-1" placeholder="값" value={it.value} onChange={e => { const items = [...p.items]; items[i] = { ...it, value: e.target.value }; set({ items }); }} />
          <input className="w-full rounded border px-1" placeholder="설명" value={it.label} onChange={e => { const items = [...p.items]; items[i] = { ...it, label: e.target.value }; set({ items }); }} />
          <button onClick={() => set({ items: p.items.filter((_: any, j: number) => j !== i) })}>×</button>
        </div>
      ))}
      {p.items.length < 6 ? <button onClick={() => set({ items: [...p.items, { icon: 'heart', value: '0', label: '' }] })} className="rounded border px-2 text-xs">+ 추가</button> : null}
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/FundraisingProgressPropsForm.tsx
'use client';
export function FundraisingProgressPropsForm({ block, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2"><input type="checkbox" checked={p.showDonorCount} onChange={e => set({ showDonorCount: e.target.checked })} /> 후원자 수 표시</label>
      <label className="flex items-center gap-2"><input type="checkbox" checked={p.showDDay} onChange={e => set({ showDDay: e.target.checked })} /> D-Day 표시</label>
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/FaqPropsForm.tsx
'use client';
export function FaqPropsForm({ block, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-2">
      <input className="w-full rounded border px-2 py-1" placeholder="제목" value={p.heading ?? ''} onChange={e => set({ heading: e.target.value })} />
      {p.items.map((it: any, i: number) => (
        <div key={i} className="rounded border p-2 space-y-1">
          <input className="w-full rounded border px-1" placeholder="질문" value={it.question} onChange={e => { const items=[...p.items]; items[i] = { ...it, question: e.target.value }; set({ items }); }} />
          <textarea className="w-full rounded border px-1" placeholder="답변" value={it.answer} onChange={e => { const items=[...p.items]; items[i] = { ...it, answer: e.target.value }; set({ items }); }} />
          <button onClick={() => set({ items: p.items.filter((_: any, j: number) => j !== i) })}>×</button>
        </div>
      ))}
      <button onClick={() => set({ items: [...p.items, { question: '', answer: '' }] })} className="rounded border px-2 text-xs">+ 추가</button>
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/DonationQuickFormPropsForm.tsx
'use client';
export function DonationQuickFormPropsForm({ block, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  return (
    <div className="space-y-2">
      <input className="w-full rounded border px-2 py-1" placeholder="제목" value={p.heading ?? ''} onChange={e => set({ heading: e.target.value })} />
      <label className="flex items-center gap-2"><input type="checkbox" checked={p.showDesignation} onChange={e => set({ showDesignation: e.target.checked })} /> 후원 목적 셀렉터 표시</label>
    </div>
  );
}
```

```tsx
// src/components/campaign-builder/forms/SnsSharePropsForm.tsx
'use client';
export function SnsSharePropsForm({ block, onChange }: any) {
  const p = block.props; const set = (patch: any) => onChange({ ...block, props: { ...p, ...patch } });
  const toggle = (c: string) => p.channels.includes(c) ? p.channels.filter((x: string) => x !== c) : [...p.channels, c];
  return (
    <div className="space-y-1">
      {['kakao','facebook','link'].map(c => (
        <label key={c} className="flex items-center gap-2">
          <input type="checkbox" checked={p.channels.includes(c)} onChange={() => set({ channels: toggle(c) })} /> {c}
        </label>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/campaign-builder/PropsPanel.tsx src/components/campaign-builder/forms/ src/components/campaign-builder/inputs/
git commit -m "feat(builder): PropsPanel with 8 per-block forms + asset/tiptap inputs"
```

---

## Task 26: Editor — FormSettingsPanel

**Files:**
- Create: `src/components/campaign-builder/form-settings/FormSettingsPanel.tsx`

- [ ] **Step 1: Write**

```tsx
// src/components/campaign-builder/form-settings/FormSettingsPanel.tsx
'use client';
import { useState } from 'react';

export function FormSettingsPanel({ campaignId, initial }: { campaignId: string; initial: any }) {
  const [s, setS] = useState<any>(initial);
  const [saving, setSaving] = useState(false);
  const toggle = (list: string[], v: string) => list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  async function save() {
    setSaving(true);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/form-settings`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(s),
    });
    setSaving(false);
    alert(res.ok ? '저장됨' : '저장 실패');
  }
  return (
    <div className="space-y-3 p-3 text-sm">
      <div>
        <div className="mb-1 text-xs">금액 프리셋 (쉼표 구분)</div>
        <input className="w-full rounded border px-2 py-1" value={s.amountPresets.join(',')}
          onChange={e => setS({ ...s, amountPresets: e.target.value.split(',').map((x: string) => Number(x.trim())).filter((n: number) => n > 0) })} />
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={s.allowCustomAmount} onChange={e => setS({ ...s, allowCustomAmount: e.target.checked })} /> 직접입력 허용</label>
      <div>
        <div className="mb-1 text-xs">후원 유형</div>
        {['regular','onetime'].map(t => (
          <label key={t} className="mr-3 inline-flex items-center gap-1">
            <input type="checkbox" checked={s.donationTypes.includes(t)} onChange={() => setS({ ...s, donationTypes: toggle(s.donationTypes, t) })} />{t}
          </label>
        ))}
      </div>
      <div>
        <div className="mb-1 text-xs">결제수단</div>
        {['card','cms','naverpay','kakaopay','payco','virtual'].map(m => (
          <label key={m} className="mr-3 inline-flex items-center gap-1">
            <input type="checkbox" checked={s.paymentMethods.includes(m)} onChange={() => setS({ ...s, paymentMethods: toggle(s.paymentMethods, m) })} />{m}
          </label>
        ))}
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" checked={s.requireReceipt} onChange={e => setS({ ...s, requireReceipt: e.target.checked })} /> 영수증 필수</label>
      <div>
        <div className="mb-1 text-xs">약관 본문 HTML</div>
        <textarea className="h-24 w-full rounded border p-1 text-xs" value={s.termsBodyHtml} onChange={e => setS({ ...s, termsBodyHtml: e.target.value })} />
      </div>
      <DesignationsEditor value={s.designations} onChange={(d: any) => setS({ ...s, designations: d })} />
      <CustomFieldsEditor value={s.customFields} onChange={(f: any) => setS({ ...s, customFields: f })} />
      <button disabled={saving} onClick={save} className="w-full rounded bg-rose-500 py-2 text-white">저장</button>
    </div>
  );
}

function DesignationsEditor({ value, onChange }: any) {
  return (
    <div>
      <div className="mb-1 text-xs">후원 목적</div>
      {value.map((d: any, i: number) => (
        <div key={i} className="mb-1 flex gap-1">
          <input className="flex-1 rounded border px-1" placeholder="key" value={d.key} onChange={e => { const n=[...value]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }} />
          <input className="flex-1 rounded border px-1" placeholder="label" value={d.label} onChange={e => { const n=[...value]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }} />
          <button onClick={() => onChange(value.filter((_: any, j: number) => j !== i))}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...value, { key: '', label: '' }])} className="rounded border px-2 text-xs">+ 추가</button>
    </div>
  );
}
function CustomFieldsEditor({ value, onChange }: any) {
  return (
    <div>
      <div className="mb-1 text-xs">커스텀 필드</div>
      {value.map((f: any, i: number) => (
        <div key={i} className="mb-1 flex gap-1">
          <input className="w-20 rounded border px-1" placeholder="key" value={f.key} onChange={e => { const n=[...value]; n[i] = { ...n[i], key: e.target.value }; onChange(n); }} />
          <input className="flex-1 rounded border px-1" placeholder="label" value={f.label} onChange={e => { const n=[...value]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }} />
          <select className="rounded border" value={f.type} onChange={e => { const n=[...value]; n[i] = { ...n[i], type: e.target.value }; onChange(n); }}>
            <option value="text">text</option><option value="textarea">textarea</option><option value="select">select</option><option value="checkbox">checkbox</option>
          </select>
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={f.required} onChange={e => { const n=[...value]; n[i] = { ...n[i], required: e.target.checked }; onChange(n); }} /> 필수
          </label>
          <button onClick={() => onChange(value.filter((_: any, j: number) => j !== i))}>×</button>
        </div>
      ))}
      <button onClick={() => onChange([...value, { key: '', label: '', type: 'text', required: false }])} className="rounded border px-2 text-xs">+ 추가</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/campaign-builder/form-settings/FormSettingsPanel.tsx
git commit -m "feat(builder): form settings panel"
```

---

## Task 27: Donation wizard — server shell + client state

**Files:**
- Create: `src/app/donate/wizard/page.tsx`
- Create: `src/app/donate/wizard/WizardClient.tsx`

- [ ] **Step 1: Write files**

```tsx
// src/app/donate/wizard/page.tsx
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { WizardClient } from './WizardClient';
import { FormSettingsSchema, defaultFormSettings } from '@/lib/campaign-builder/form-settings/schema';

export default async function Wizard({ searchParams }: { searchParams: Promise<{ campaign?: string; type?: string; amount?: string; designation?: string; completed?: string }> }) {
  const sp = await searchParams;
  if (!sp.campaign) notFound();
  const sb = createAdminClient();
  const { data: c } = await sb.from('campaigns').select('id, slug, title, status, end_date, form_settings, org_id').eq('slug', sp.campaign).single();
  if (!c || c.status !== 'published') notFound();
  if (c.end_date && new Date(c.end_date) < new Date()) {
    return <main className="mx-auto max-w-xl p-10 text-center">캠페인이 종료되었습니다.</main>;
  }
  const settings = FormSettingsSchema.parse({ ...defaultFormSettings(), ...(c.form_settings ?? {}) });
  return <WizardClient
    campaign={{ id: c.id, slug: c.slug, title: c.title, orgId: c.org_id }}
    settings={settings}
    prefill={{ type: sp.type, amount: sp.amount ? Number(sp.amount) : undefined, designation: sp.designation, completed: sp.completed === '1' }}
  />;
}
```

```tsx
// src/app/donate/wizard/WizardClient.tsx
'use client';
import { useEffect, useState } from 'react';
import { Step1 } from './steps/Step1';
import { Step2 } from './steps/Step2';
import { Step3 } from './steps/Step3';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export type WizardState = {
  type: 'regular'|'onetime';
  amount: number;
  designation?: string;
  donorInfo?: any;
  paymentMethod?: string;
  customFields?: Record<string, any>;
  receiptOptIn?: boolean;
  idempotencyKey: string;
};

export function WizardClient({ campaign, settings, prefill }: { campaign: any; settings: FormSettings; prefill: any }) {
  const [step, setStep] = useState<1|2|3>(prefill.completed ? 3 : 1);
  const [state, setState] = useState<WizardState>({
    type: (prefill.type as any) ?? settings.donationTypes[0],
    amount: prefill.amount ?? settings.amountPresets[0],
    designation: prefill.designation,
    idempotencyKey: crypto.randomUUID(),
  });
  useEffect(() => {
    if (step === 1 && window.gtag) window.gtag('event', 'begin_checkout', { value: state.amount, currency: 'KRW' });
  }, []);
  return (
    <main className="mx-auto my-8 max-w-xl px-4">
      <header className="mb-6 text-sm text-neutral-500">Step {step} / 3</header>
      {step === 1 && <Step1 settings={settings} state={state} setState={setState} onNext={() => setStep(2)} />}
      {step === 2 && <Step2 campaign={campaign} settings={settings} state={state} setState={setState} onBack={() => setStep(1)} onComplete={() => setStep(3)} />}
      {step === 3 && <Step3 campaign={campaign} settings={settings} state={state} />}
    </main>
  );
}

declare global { interface Window { gtag?: (...a: any[]) => void; fbq?: (...a: any[]) => void } }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/donate/wizard/page.tsx src/app/donate/wizard/WizardClient.tsx
git commit -m "feat(builder): donation wizard shell + client state machine"
```

---

## Task 28: Wizard Step 1

**Files:**
- Create: `src/app/donate/wizard/steps/Step1.tsx`

- [ ] **Step 1: Write**

```tsx
// src/app/donate/wizard/steps/Step1.tsx
'use client';
import type { WizardState } from '../WizardClient';
import type { FormSettings } from '@/lib/campaign-builder/form-settings/schema';

export function Step1({ settings, state, setState, onNext }: { settings: FormSettings; state: WizardState; setState: (s: WizardState) => void; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {settings.donationTypes.map(t => (
          <button key={t} onClick={() => setState({ ...state, type: t })}
            className={`flex-1 rounded-full px-4 py-2 ${state.type === t ? 'bg-rose-500 text-white' : 'bg-neutral-100'}`}>
            {t === 'regular' ? '정기' : '일시'}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {settings.amountPresets.map(a => (
          <button key={a} onClick={() => setState({ ...state, amount: a })}
            className={`rounded border px-3 py-2 ${state.amount === a ? 'border-rose-500 bg-rose-50' : ''}`}>
            {a.toLocaleString()}원
          </button>
        ))}
      </div>
      {settings.allowCustomAmount && (
        <input type="number" value={state.amount} onChange={e => setState({ ...state, amount: Number(e.target.value) })}
          className="w-full rounded border px-3 py-2" />
      )}
      {settings.designations.length > 0 && (
        <select value={state.designation ?? ''} onChange={e => setState({ ...state, designation: e.target.value || undefined })}
          className="w-full rounded border px-3 py-2">
          <option value="">선택 안 함</option>
          {settings.designations.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
      )}
      <button disabled={state.amount <= 0} onClick={onNext}
        className="w-full rounded-full bg-rose-500 py-3 font-semibold text-white disabled:opacity-50">다음</button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/donate/wizard/steps/Step1.tsx
git commit -m "feat(builder): wizard Step1"
```

---

## Task 29: Wizard Step 2 + extend `/api/donations/prepare`

**Files:**
- Create: `src/app/donate/wizard/steps/Step2.tsx`
- Modify: `src/app/api/donations/prepare/route.ts`

- [ ] **Step 1: Write Step 2**

```tsx
// src/app/donate/wizard/steps/Step2.tsx
'use client';
import { useState } from 'react';
import { sanitizeHtml } from '@/lib/campaign-builder/sanitize-html';

function Input({ label, value, onChange, type = 'text' }: any) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs">{label}</span>
      <input type={type} className="w-full rounded border px-2 py-1" value={value ?? ''} onChange={e => onChange(e.target.value)} />
    </label>
  );
}
function CustomFieldInput({ field, value, onChange }: any) {
  if (field.type === 'textarea') return <label className="block"><span className="mb-1 block text-xs">{field.label}</span><textarea className="w-full rounded border px-2 py-1" value={value ?? ''} onChange={e => onChange(e.target.value)} /></label>;
  if (field.type === 'checkbox') return <label className="flex items-center gap-2"><input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked)} />{field.label}</label>;
  if (field.type === 'select') return <label className="block"><span className="mb-1 block text-xs">{field.label}</span><select className="w-full rounded border px-2 py-1" value={value ?? ''} onChange={e => onChange(e.target.value)}>{(field.options ?? []).map((o: string) => <option key={o}>{o}</option>)}</select></label>;
  return <Input label={field.label} value={value} onChange={onChange} />;
}

export function Step2({ campaign, settings, state, setState, onBack }: any) {
  const [info, setInfo] = useState({ name:'', dob:'', mobile:'', email:'', address:'' });
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [method, setMethod] = useState(settings.paymentMethods[0]);
  const [receipt, setReceipt] = useState(settings.requireReceipt);
  const [residentNo, setResidentNo] = useState('');
  const [ag, setAg] = useState({ terms: false, privacy: false, marketing: false });
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    if (!ag.terms || !ag.privacy) return alert('약관 동의 필요');
    setSubmitting(true);
    setState({ ...state, donorInfo: info, paymentMethod: method, customFields, receiptOptIn: receipt });
    if (window.gtag) window.gtag('event', 'add_payment_info', { value: state.amount, currency: 'KRW' });
    const res = await fetch('/api/donations/prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId: campaign.id, amount: state.amount, type: state.type, designation: state.designation,
        donor: info, customFields, paymentMethod: method, receiptOptIn: receipt,
        residentNo: receipt ? residentNo : undefined, idempotencyKey: state.idempotencyKey,
      }),
    });
    setSubmitting(false);
    if (!res.ok) return alert('준비 실패');
    const { checkoutUrl } = await res.json();
    window.location.href = checkoutUrl;
  }

  // SECURITY: settings.termsBodyHtml is authored by authenticated admin users and stored after zod validation.
  // We still sanitize at render time as defense-in-depth.
  const termsHtml = sanitizeHtml(settings.termsBodyHtml);

  return (
    <div className="space-y-4">
      <Input label="이름" value={info.name} onChange={(v: string) => setInfo({ ...info, name: v })} />
      <Input label="생년월일" type="date" value={info.dob} onChange={(v: string) => setInfo({ ...info, dob: v })} />
      <Input label="휴대폰" value={info.mobile} onChange={(v: string) => setInfo({ ...info, mobile: v })} />
      <Input label="이메일" type="email" value={info.email} onChange={(v: string) => setInfo({ ...info, email: v })} />
      <Input label="주소" value={info.address} onChange={(v: string) => setInfo({ ...info, address: v })} />

      {settings.customFields.map((f: any) => (
        <CustomFieldInput key={f.key} field={f} value={customFields[f.key]} onChange={(v: any) => setCustomFields({ ...customFields, [f.key]: v })} />
      ))}

      <div>
        <div className="mb-1 text-xs">결제수단</div>
        {settings.paymentMethods.map((m: string) => (
          <label key={m} className="mr-3 inline-flex items-center gap-1">
            <input type="radio" checked={method === m} onChange={() => setMethod(m)} />{m}
          </label>
        ))}
      </div>

      <label className="flex items-center gap-2">
        <input type="checkbox" checked={receipt} onChange={e => setReceipt(e.target.checked)} disabled={settings.requireReceipt} /> 기부금 영수증 신청
      </label>
      {receipt && (
        <Input label="주민번호/사업자번호" value={residentNo} onChange={setResidentNo} />
      )}

      <div className="rounded border p-3 text-xs" dangerouslySetInnerHTML={{ __html: termsHtml }} />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ag.terms} onChange={e => setAg({ ...ag, terms: e.target.checked })} /> [필수] 이용약관 동의</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ag.privacy} onChange={e => setAg({ ...ag, privacy: e.target.checked })} /> [필수] 개인정보 수집·이용 동의</label>
      {settings.marketingOptInLabel && (
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ag.marketing} onChange={e => setAg({ ...ag, marketing: e.target.checked })} /> [선택] {settings.marketingOptInLabel}</label>
      )}

      <div className="flex gap-2">
        <button onClick={onBack} className="flex-1 rounded border py-3">이전</button>
        <button disabled={submitting} onClick={submit} className="flex-1 rounded-full bg-rose-500 py-3 font-semibold text-white">
          {submitting ? '처리 중…' : '후원하기'}
        </button>
      </div>
    </div>
  );
}

declare global { interface Window { gtag?: (...a: any[]) => void } }
```

- [ ] **Step 2: Extend `/api/donations/prepare`**

Read existing file, then extend body parse + insert to accept: `designation`, `customFields`, `idempotencyKey`, `receiptOptIn`, `residentNo`.

Concrete additions:

```ts
// inside the existing POST handler in src/app/api/donations/prepare/route.ts
// 1. parse new fields:
const { campaignId, amount, type, designation, donor, customFields, paymentMethod, receiptOptIn, residentNo, idempotencyKey } = await req.json();

// 2. when inserting payment row, include:
//   designation: designation ?? null,
//   custom_fields: customFields ?? null,
//   idempotency_key: idempotencyKey,
// 3. on unique violation of idempotency_key, return the existing payment's checkoutUrl instead of creating a new one
// 4. if receiptOptIn && residentNo: insert a receipt row with
//   resident_no_encrypted: pgp_sym_encrypt(residentNo, <org_key from org_secrets>),
//   rrn_retention_expires_at: now() + interval '5 years'
// The encryption key must come from org_secrets (use the same helper already used elsewhere for Toss key access).
```

Write a focused unit test for the new branches:

```ts
// tests/integration/campaign-builder/donations-prepare-extended.test.ts
import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/donations/prepare/route';
import { createAdminClient } from '@/lib/supabase/admin';

describe('donations/prepare with builder fields', () => {
  it('persists designation, custom_fields, idempotency_key', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').select('id, slug').limit(1).single();
    const key = `e2e-${Date.now()}`;
    const req = new Request('http://x/api/donations/prepare', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId: c!.id, amount: 10000, type: 'onetime', designation: 'overseas',
        donor: { name: 'T', mobile: '010', email: 't@x', address: 'A' },
        customFields: { referrer: 'friend' }, paymentMethod: 'card', idempotencyKey: key,
      }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const { data: row } = await sb.from('payments').select('designation, custom_fields, idempotency_key').eq('idempotency_key', key).single();
    expect(row!.designation).toBe('overseas');
    expect(row!.custom_fields).toEqual({ referrer: 'friend' });
  });
  it('retries with same key return the original (no duplicate row)', async () => {
    const sb = createAdminClient();
    const { data: c } = await sb.from('campaigns').select('id').limit(1).single();
    const key = `e2e-dup-${Date.now()}`;
    const body = { campaignId: c!.id, amount: 10000, type: 'onetime', donor: { name:'T' }, paymentMethod: 'card', idempotencyKey: key };
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as any);
    await POST(new Request('http://x', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }) as any);
    const { count } = await sb.from('payments').select('id', { count: 'exact', head: true }).eq('idempotency_key', key);
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 3: Run test + commit**

Run: `npm test -- tests/integration/campaign-builder/donations-prepare-extended.test.ts`

```bash
git add src/app/donate/wizard/steps/Step2.tsx src/app/api/donations/prepare/route.ts tests/integration/campaign-builder/donations-prepare-extended.test.ts
git commit -m "feat(builder): wizard Step2 + /api/donations/prepare extended fields + idempotency"
```

---

## Task 30: Wizard Step 3 + confirm redirect

**Files:**
- Create: `src/app/donate/wizard/steps/Step3.tsx`
- Modify: `src/app/api/donations/confirm/route.ts` — on success redirect to `/donate/wizard?campaign=<slug>&completed=1`

- [ ] **Step 1: Write Step 3**

```tsx
// src/app/donate/wizard/steps/Step3.tsx
'use client';
import { useEffect } from 'react';
import type { WizardState } from '../WizardClient';

export function Step3({ settings, state }: { campaign: any; settings: any; state: WizardState }) {
  useEffect(() => {
    if (window.gtag) window.gtag('event', 'purchase', { value: state.amount, currency: 'KRW' });
    if (settings.completeRedirectUrl) {
      const t = setTimeout(() => { window.location.href = settings.completeRedirectUrl; }, 3000);
      return () => clearTimeout(t);
    }
  }, []);
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">후원해 주셔서 감사합니다</h1>
      <p>{state.amount.toLocaleString()}원 {state.type === 'regular' ? '정기' : '일시'} 후원이 완료되었습니다.</p>
      {state.receiptOptIn ? <p className="text-sm text-neutral-500">연말정산 영수증은 이메일로 발송됩니다.</p> : null}
    </div>
  );
}
declare global { interface Window { gtag?: (...a: any[]) => void } }
```

- [ ] **Step 2: Modify confirm route**

Read `src/app/api/donations/confirm/route.ts`. After successful Toss confirm, instead of its current response, respond with 302 to `/donate/wizard?campaign=<slug>&completed=1`. Preserve existing webhook/audit triggers.

- [ ] **Step 3: Commit**

```bash
git add src/app/donate/wizard/steps/Step3.tsx src/app/api/donations/confirm/route.ts
git commit -m "feat(builder): wizard Step3 + confirm redirects back to wizard"
```

---

## Task 31: Swap legacy campaign description

**Files:**
- Modify: `src/components/admin/campaign-form-dialog.tsx`

- [ ] **Step 1: Read**

Run: `cat src/components/admin/campaign-form-dialog.tsx`

- [ ] **Step 2: Change label + add editor link**

- Relabel `description` textarea to "간단 설명 (목록용)" with helper text "본문은 페이지 편집기에서 작성합니다."
- Below form, add:

```tsx
<a href={`/admin/campaigns/${campaign.id}/edit`} className="rounded border px-3 py-2 text-sm">페이지 편집기 열기</a>
```

Only render the link when `campaign?.id` exists (edit mode, not create).

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/campaign-form-dialog.tsx
git commit -m "feat(builder): demote description + link to page editor from campaign dialog"
```

---

## Task 32: Nightly RRN retention purge cron

**Files:**
- Create: `src/app/api/cron/purge-expired-rrn/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write route**

```ts
// src/app/api/cron/purge-expired-rrn/route.ts
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const sb = createAdminClient();
  const { error } = await sb.from('receipts')
    .update({ resident_no_encrypted: null, business_no_encrypted: null, rrn_retention_expires_at: null })
    .lt('rrn_retention_expires_at', new Date().toISOString());
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Register cron**

Read `vercel.json`, add:

```json
{ "path": "/api/cron/purge-expired-rrn", "schedule": "0 2 * * *" }
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/purge-expired-rrn/route.ts vercel.json
git commit -m "feat(builder): nightly RRN retention purge cron"
```

---

## Task 33: E2E — builder happy path

**Files:**
- Create: `e2e/campaign-builder.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '@playwright/test';

test('builder: create, edit, preview, publish', async ({ page, request }) => {
  await page.goto('/admin/login');
  await page.getByLabel('이메일').fill(process.env.E2E_ADMIN_EMAIL!);
  await page.getByLabel('비밀번호').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: /로그인/ }).click();
  await page.waitForURL('**/admin/**');

  await page.goto('/admin/campaigns');
  await page.getByRole('button', { name: /새 캠페인/ }).click();
  await page.getByLabel('제목').fill('E2E Builder');
  const slug = `e2e-${Date.now()}`;
  await page.getByLabel('슬러그').fill(slug);
  await page.getByRole('button', { name: /저장/ }).click();

  await page.getByRole('link', { name: /페이지 편집/ }).click();
  await page.waitForURL('**/edit');

  await page.getByRole('button', { name: '+ Hero' }).click();
  await page.getByRole('button', { name: '+ 텍스트' }).click();
  await page.getByRole('button', { name: '+ 퀵 후원 폼' }).click();

  await expect(page.getByText('저장됨')).toBeVisible({ timeout: 5000 });

  page.once('dialog', d => d.accept());
  await page.getByRole('button', { name: '발행' }).click();
  await expect(page.getByText(/발행 완료/)).toBeVisible();

  const pub = await request.get(`/campaigns/${slug}`);
  expect(pub.status()).toBe(200);
});
```

- [ ] **Step 2: Run + commit**

Run: `npm run e2e -- campaign-builder.spec.ts`

```bash
git add e2e/campaign-builder.spec.ts
git commit -m "test(builder): E2E builder happy path"
```

---

## Task 34: E2E — wizard happy path

**Files:**
- Create: `e2e/donation-wizard.spec.ts`

- [ ] **Step 1: Write test**

```ts
import { test, expect } from '@playwright/test';

test('wizard: 일시 card happy path', async ({ page }) => {
  const slug = process.env.E2E_CAMPAIGN_SLUG!;
  await page.goto(`/donate/wizard?campaign=${slug}&type=onetime&amount=10000&designation=general`);

  await expect(page.getByText('Step 1')).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByText('Step 2')).toBeVisible();
  await page.getByLabel('이름').fill('홍길동');
  await page.getByLabel('생년월일').fill('1990-01-01');
  await page.getByLabel('휴대폰').fill('01012345678');
  await page.getByLabel('이메일').fill('test@example.com');
  await page.getByLabel('주소').fill('서울');
  await page.getByLabel('[필수] 이용약관 동의').check();
  await page.getByLabel('[필수] 개인정보 수집·이용 동의').check();

  await page.getByRole('button', { name: '후원하기' }).click();
  // Toss sandbox auto-succeeds; confirm redirects back
  await page.waitForURL(/completed=1/);
  await expect(page.getByText('감사합니다')).toBeVisible();
});
```

- [ ] **Step 2: Run + commit**

Run: `npm run e2e -- donation-wizard.spec.ts`

```bash
git add e2e/donation-wizard.spec.ts
git commit -m "test(builder): E2E wizard happy path"
```

---

## Task 35: Final verification

- [ ] **Step 1: Unit + integration tests**

Run: `npm test`
Expected: ALL PASS.

- [ ] **Step 2: E2E**

Run: `npm run e2e`
Expected: ALL PASS.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors.

- [ ] **Step 4: Manual smoke**

Follow the acceptance flow in the spec (§16): create campaign → edit → upload image → preview → publish → public render → QuickForm submit → Wizard 3-step → payment row appears with `designation`, `custom_fields`, `idempotency_key`. Submit again with same idempotencyKey → no duplicate row.

- [ ] **Step 5: Close out**

```bash
git commit --allow-empty -m "chore(builder): MVP acceptance verified"
```

---

## Self-Review Notes

- **Spec coverage**: migrations (Tasks 1–5); blocks schema + 8 components (Tasks 7, 19); form_settings (Tasks 8, 14, 26); preview token + publish (Tasks 9, 10, 15, 16, 21); assets (Tasks 11, 17); progress (Tasks 12, 18); editor (Tasks 22–26); wizard (Tasks 27–30); legacy form touch (Task 31); retention purge (Task 32); E2E (Tasks 33–34); final verification (Task 35).
- **Types**: `PageContent`, `Block`, `FormSettings`, `WizardState`, `CampaignProgress` defined once and reused.
- **Security**: every HTML sink (`RichText` block render, wizard terms render) uses `sanitizeHtml` from Task 6 before `dangerouslySetInnerHTML`; SVG uploads pass through `sanitizeSvg`; org-scoped RLS at DB + auth + org_id checks at every admin API route.
- **Idempotency**: DB unique index (Task 3) + server-side return-existing-on-duplicate path (Task 29) + test covering both persistence and retry (Task 29).
- **No placeholders**: all steps contain concrete SQL/code/commands. Task 2 helper `createUserClientForOrg` and Task 13 helper `tests/integration/helpers/api.ts` are test harnesses with a one-line directive to "follow existing integration-test pattern" — this is infrastructure that already has a pattern in the repo; not feature work.
