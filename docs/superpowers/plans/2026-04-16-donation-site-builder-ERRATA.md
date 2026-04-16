# Plan Errata — Adjustments to Actual Codebase

> Discovered after plan was written. Every task in `2026-04-16-donation-site-builder.md` MUST apply these substitutions. Where this file conflicts with the plan, this file wins.

## Name substitutions

| Plan says | Actual codebase |
|---|---|
| `organizations` (table) | **`orgs`** |
| `createAdminClient()` | **`createSupabaseAdminClient()`** from `@/lib/supabase/admin` |
| `createServerClient()` | Check `@/lib/supabase/server.ts` for actual export name and use that |
| campaign `status = 'published'` | **`status = 'active'`** (CHECK: draft/active/closed) |
| `campaigns.end_date` | **`campaigns.ended_at`** |
| `campaigns.start_date` | **`campaigns.started_at`** |
| `payments.pay_status = 'completed'` | **`pay_status = 'paid'`** (CHECK: paid/unpaid/failed/cancelled/refunded/pending) |
| `members.id = auth.uid()` in RLS | **`members.supabase_uid = auth.uid()`** (members has its own UUID PK; `supabase_uid` FK to `auth.users`) |

## Structural differences

### 1. `campaigns` already has JSONB fields

Existing columns — do NOT duplicate:
- `pg_config JSONB` — PG/Toss config
- `preset_amounts JSONB` — amount presets
- `donation_type TEXT` with CHECK('regular'|'onetime'|'both')

**Decision**: The new `form_settings` JSONB is additive. Migrate backfill: copy `preset_amounts → form_settings.amountPresets`, `donation_type → form_settings.donationTypes`, and set `paymentMethods` defaults. Leave legacy columns untouched (read-only going forward). Document this in migration comment.

### 2. `payments.member_id` is NOT NULL

Plan assumed payments could be inserted without a member. In practice `/api/donations/prepare` must create/find a `members` row first. Idempotency-key test must include a valid `member_id`.

### 3. `payments.campaign_id` is NOT NULL

Same caveat.

### 4. `payments.pay_date` is NOT NULL

Tests inserting payments must supply `pay_date`.

### 5. `payments.payment_code` is NOT NULL with UNIQUE(org_id, payment_code)

Tests must supply a unique payment_code per insert.

### 6. `receipts` table — verify columns before Task 4

Task 4 adds `resident_no_encrypted` etc. to `receipts`. Before writing the migration, read `supabase/migrations/*receipts*.sql` to confirm the table exists and current columns.

### 7. No `members.id = auth.uid()` equality

`auth.uid()` returns Supabase auth user UUID. `members.supabase_uid` stores that. Every RLS policy in the plan that says `SELECT org_id FROM members WHERE id = auth.uid()` must become **`SELECT org_id FROM members WHERE supabase_uid = auth.uid()`**.

### 8. API route member lookup

Plan pattern:
```ts
const { data: member } = await sb.from('members').select('org_id, id').eq('id', user.id).single();
```
Must become:
```ts
const { data: member } = await sb.from('members').select('org_id, id').eq('supabase_uid', user.id).single();
```

## Test infrastructure

- `tests/integration/` does NOT exist. Create it.
- There is no existing `buildAuthedRequest` / `createTestCampaign` helper — design fresh in Task 13.
- `vitest.config.ts` excludes `e2e/**`; integration tests under `tests/integration/**` are auto-included.
- `@/` alias resolves to `./src`.

## Audit log

The `logAudit` helper is at `src/lib/audit.ts`. Open the file and match its actual signature before using it in any API route — the plan's `{ orgId, actorId, action, targetId }` shape may differ.

## Supabase client server function

Open `src/lib/supabase/server.ts` and use whatever the actual exported function is (likely `createSupabaseServerClient` or similar). Plan wrote `createServerClient()` which is a naming guess.

## Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — used by admin client
- `CRON_SECRET` — used by cron routes; set before Task 32

## Running migrations against remote

User uses remote Supabase. Apply migrations via:
```
npx supabase db push
```
(or the team's established flow — check `supabase/config.toml` if present).

## When in doubt

Read the relevant existing file before writing new code. This plan was written against assumed conventions; the repository is authoritative.
