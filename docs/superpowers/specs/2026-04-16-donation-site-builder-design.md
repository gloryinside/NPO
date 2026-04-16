# Donation Site Builder — Design Spec

- **Date**: 2026-04-16
- **Author**: yklee@c2ware.com (with Claude)
- **Status**: Approved for implementation planning
- **Scope**: MVP of a no-code donation campaign landing-page builder integrated into the existing NPO donation management system

---

## 1. Background & Problem

The current system implements Phase 1–3 of the requirements document (후원자/약정/결제/영수증/관리자/ERP API/CRON). However, **§4.1 "캠페인 페이지 생성 — 노코드 편집기"** is not implemented. Campaigns today store only a single `description` HTML field; there is no way for an organization to compose a story-driven landing page with blocks, imagery, impact stats, progress widgets, and an embedded donation CTA without developer involvement.

This spec defines the MVP of a block-based, WYSIWYG-lite campaign page builder, plus a fixed donation wizard that handles payment/legal logic outside the builder.

## 2. Goals / Non-goals

**Goals (MVP)**
- NPO admins can create, edit, preview, and publish a distinct landing page per campaign without code.
- Eight block types cover ~90% of observed Korean NPO donation landing pages (굿네이버스, 월드비전, 세이브더칠드런, 유니세프, 컴패션 patterns).
- Draft/Published separation with a preview-by-token link.
- A fixed 3-step donation wizard handles all payment, personal-info, consent, and receipt logic; the builder cannot alter it.
- Existing Toss Payments integration (card + CMS billingKey + 간편결제) is reused.

**Non-goals (MVP)**
- Free-form 2D grid layout (Webflow-style). Blocks stack vertically.
- Inline click-to-edit (Notion-style). Editing happens in the right-side props panel.
- Undo/redo history and version rollback (Phase 2).
- Mobile identity verification (KG/NICE), 전자서명 pad, 14세 미만 보호자동의 flow, 금융결제원 CMS direct integration (Phase 2).
- P2P fundraising pages (Phase 2+).
- Block-level responsive overrides beyond a simple `hiddenOn` array.

## 3. Market Reference (summary)

- **굿네이버스**: 8+ concurrent campaigns, each with an independent landing URL and a single donation form per page. "One campaign = one story = one form".
- **월드비전 `/support/`**: Not a story landing; a 3-step wizard (방식 → 정보·결제 → 완료). The same wizard page is reused across designations via URL param `?code=2901|2921|2923`. Includes 휴대폰 본인인증, 전자서명 pad, 만 14세 미만 보호자동의, 이체일 선택(10일/25일), 주민번호 수집(영수증).
- **공통 블록 순서**: Hero → Problem → Story → Impact → Progress → Donation form → Custom fields → Receipt info → FAQ → Testimonial → SNS share → Footer.

**Implication**: Split the system into two layers — (a) a builder-driven **story landing page** and (b) a **fixed donation wizard**. The wizard is reused across campaigns; the builder never edits it. This matches the 월드비전 pattern while preserving the 굿네이버스 "campaign = landing page" 1:1 model.

## 4. Architecture

```
[Admin Editor]                          [Public Runtime]
/admin/campaigns/[id]/edit        →     /campaigns/[slug]                  (published landing)
        │                                       │
        │ writes JSON page_content              │ BlockRenderer reads published_content
        ▼                                       ▼
   campaigns.page_content (draft)          campaigns.published_content
                                                │ CTAs submit to
                                                ▼
                                         /donate/wizard?campaign=&amount=&type=&designation=
                                                │ fixed 3-step form; reuses existing Toss integration
                                                ▼
                                         payments / promises (existing tables)
```

- **Campaign Landing (builder-editable)**: JSON block tree. Draft/Published separation. Preview by token.
- **Donation Wizard (fixed)**: New route `/donate/wizard` extending existing `/donate/` namespace. Reads campaign's `form_settings` for presets/methods/customFields/designations. Payment logic reuses `lib/toss` and existing webhook + CRON.
- **Assets**: Supabase Storage bucket `campaign-assets` with metadata in `campaign_assets` table.

## 5. Data Model

### 5.1 `campaigns` — add columns

| Column | Type | Notes |
|---|---|---|
| `page_content` | `JSONB` default `'{"blocks":[],"meta":{"schemaVersion":1}}'` | Draft block tree |
| `published_content` | `JSONB` default `'{}'` | Snapshot used by public renderer |
| `published_at` | `TIMESTAMPTZ NULL` | Last publish time |
| `preview_token` | `TEXT NULL` | 16-byte base64url; rotatable |
| `form_settings` | `JSONB` default `'{}'` | Wizard injection config (see §5.4) |

### 5.2 `campaign_assets` — new

| Column | Type | Notes |
|---|---|---|
| `id` | `UUID PK` | |
| `org_id` | `UUID FK organizations` | RLS scope |
| `campaign_id` | `UUID FK campaigns NULL` | Null = reusable across campaigns within org |
| `storage_path` | `TEXT` | `campaign-assets/{org_id}/{yyyy-mm}/{uuid}.{ext}` |
| `public_url` | `TEXT` | |
| `mime_type` | `TEXT` | whitelist: jpeg/png/webp/gif/svg |
| `size_bytes` | `INT` | max 5MB |
| `width`, `height` | `INT NULL` | for images |
| `created_at` | `TIMESTAMPTZ` default `now()` | |
| `created_by` | `UUID FK members` | |

RLS: `org_id` isolation (same pattern as existing tables). Storage bucket policy: public read, authenticated write scoped to org.

### 5.3 `payments` — add columns

| Column | Type | Notes |
|---|---|---|
| `designation` | `TEXT NULL` | e.g. "해외아동". Index for reporting. |
| `custom_fields` | `JSONB NULL` | Campaign-defined custom field responses |
| `idempotency_key` | `TEXT NULL UNIQUE` | Wizard submit guard against double-submit |

### 5.3a `receipts` — add columns (RRN lives here, not on payments)

| Column | Type | Notes |
|---|---|---|
| `resident_no_encrypted` | `BYTEA NULL` | `pgp_sym_encrypt` result; key from `org_secrets` |
| `business_no_encrypted` | `BYTEA NULL` | 사업자번호 (기부자가 법인일 때) |
| `rrn_retention_expires_at` | `TIMESTAMPTZ NULL` | `issued_at + 5 years` per 소득세법 §160-3; nightly job purges expired |

### 5.4 `form_settings` JSONB shape

```json
{
  "amountPresets": [10000, 30000, 50000, 100000],
  "allowCustomAmount": true,
  "donationTypes": ["regular", "onetime"],
  "paymentMethods": ["card", "cms", "naverpay", "kakaopay", "virtual"],
  "designations": [{ "key": "overseas", "label": "해외아동" }],
  "customFields": [
    { "key": "referrer", "label": "추천인", "type": "text", "required": false },
    { "key": "message", "label": "응원메시지", "type": "textarea", "required": false }
  ],
  "requireReceipt": false,
  "termsBodyHtml": "<p>...</p>",
  "marketingOptInLabel": "뉴스레터 수신 동의",
  "completeRedirectUrl": null
}
```

### 5.5 Block tree shape

```json
{
  "meta": { "schemaVersion": 1 },
  "blocks": [
    { "id": "uuid", "type": "hero", "props": { ... }, "anchor": "top", "hiddenOn": [] },
    ...
  ]
}
```

Render order = array order. Unknown `type` is skipped (forward compatibility).

## 6. Block Catalog (8 types, MVP)

All blocks share optional `anchor?: string` and `hiddenOn?: ("mobile"|"desktop")[]`.

| # | Type | Props | Render notes |
|---|---|---|---|
| 1 | `hero` | `backgroundImageAssetId, headline, subheadline, ctaLabel, ctaAnchorBlockId?` | Full-bleed bg image; H1/subcopy/CTA centered. CTA scrolls to anchor or falls back to wizard. |
| 2 | `richText` | `html` | Sanitized via isomorphic-dompurify. Tailwind `prose`. Simple Tiptap toolbar in editor. |
| 3 | `imageSingle` | `assetId, altText, caption?, linkUrl?` | Next/Image responsive; caption below. |
| 4 | `impactStats` | `heading?, items: [{icon, value, label}]` (max 6) | Responsive grid. Lucide icon whitelist. |
| 5 | `fundraisingProgress` | `showDonorCount, showDDay` | Server queries `goal_amount` + `SUM(payments.amount)` for campaign. ISR 60s with `revalidateTag('campaign:'+slug)`. |
| 6 | `faq` | `heading?, items: [{question, answer}]` | Base-UI Accordion. |
| 7 | `donationQuickForm` | `heading?, showDesignation` | Reads campaign `form_settings` for options. Submits GET to `/donate/wizard?campaign=&type=&amount=&designation=`. Does NOT collect personal info or process payment. |
| 8 | `snsShare` | `channels: ("kakao"|"facebook"|"link")[]` | Kakao SDK when key configured; otherwise link-copy fallback. |

## 7. Donation Wizard (fixed)

### 7.1 Route & query

- Route: `/donate/wizard`
- Query: `campaign=<slug>` (required), `type=<regular|onetime>` (optional prefill), `amount=<number>` (optional prefill), `designation=<key>` (optional prefill)

### 7.2 Step 1 — 방식 확정
- 정기/일시 toggle (limited by `form_settings.donationTypes`)
- Amount presets + custom input (from `amountPresets`/`allowCustomAmount`)
- Designation selector (only if `designations.length > 0`)
- "다음" → Step 2

### 7.3 Step 2 — 정보·약관·결제
- Individual/Corporate radio
- Name, DOB, mobile, email, address (Daum 우편번호 API)
- Custom fields rendered from `form_settings.customFields` (types: text | textarea | select | checkbox)
- Receipt opt-in → if enabled, show RRN / 사업자번호. Stored encrypted with `pgp_sym_encrypt` on the `receipts` row (columns defined in §5.3a). Encryption key loaded from `org_secrets`. Never logged. Decrypted only at receipt issuance. Retention: 5 years from `issued_at` per 소득세법 §160-3, then purged by nightly job.
- Payment method radio, limited by `form_settings.paymentMethods`
- Consents (3): 이용약관 · 개인정보 수집·이용 · (optional) marketing
- "후원하기" → existing Toss SDK (lib/toss) → on success, callback to `/api/donations/confirm` (existing)

### 7.4 Step 3 — 완료
- Summary (amount, type, designation, receipt status)
- Triggers existing post-payment SMS/email audit
- If `completeRedirectUrl` set, auto-redirect after 3s

### 7.5 Error & edge cases
- Campaign not published OR past end date → blocked page before Step 1
- Payment failure → return to Step 2 with error banner, preserve inputs
- Double-submit guard: wizard generates a UUID `idempotency_key` on Step 2 load, submits it with the payment intent; server writes it to `payments.idempotency_key` (UNIQUE). Retries with the same key are rejected with the original result.

### 7.6 Tracking
- Reuse `campaign_tracking` (GA/Meta pixel already stored per campaign)
- Fire `begin_checkout` (Step 1 submit), `add_payment_info` (Step 2 submit), `purchase` (Step 3 load)

### 7.7 Out of scope (Phase 2)
- 휴대폰 본인인증, 전자서명 pad, 14세 미만 보호자동의, 이체일 선택 (requires 금융결제원 CMS direct integration). Toss billingKey covers automated monthly debit today.

## 8. Editor UX

### 8.1 Route & layout
- Route: `/admin/campaigns/[id]/edit`
- Top bar: title · autosave indicator · mobile/desktop toggle · [미리보기] · [발행]
- Left palette (240px): 8 block cards + "폼 설정" tab for `form_settings`
- Center canvas: live block renderer. Widths 375/1280 simulated on toggle.
- Right panel (320px): zod-driven props form (react-hook-form + `@hookform/resolvers/zod`). Image fields use Supabase Storage uploader → creates `campaign_assets` row → stores `assetId`.

### 8.2 Block interactions
- Hover block → toolbar: `≡ drag handle · ↑ · ↓ · duplicate · delete`
- Click block → select (blue outline), right panel shows its props
- Reorder: `@dnd-kit/sortable` on `≡` handle only

### 8.3 Autosave
- Debounce 2s → `PATCH /api/admin/campaigns/[id]/page-content`
- Optimistic UI; toast on error with retry

### 8.4 Preview
- [미리보기] → generate/rotate `preview_token` via `POST /api/admin/campaigns/[id]/preview-token`
- Open `/campaigns/[slug]/preview?token=...` in new tab
- Preview page sets `<meta name="robots" content="noindex,nofollow">`

### 8.5 Publish
- [발행] → confirm dialog → `POST /api/admin/campaigns/[id]/publish`
- Server:
  1. Validate `page_content` (zod)
  2. Copy `page_content → published_content`
  3. Set `published_at = now()`; ensure `status = 'published'`
  4. Call `revalidateTag('campaign:'+slug)`
- Public `/campaigns/[slug]` only renders `published_content`
- Unpublished draft changes show a "미발행 변경사항 있음" badge in the editor top bar

### 8.6 Permissions & audit
- Access: admin member whose `org_id` matches campaign's `org_id` (existing RLS + middleware)
- Audit log events: `campaign.page_edit`, `campaign.publish`, `campaign.asset_upload`, `campaign.asset_delete`

## 9. API

| Method | Path | Purpose |
|---|---|---|
| PATCH | `/api/admin/campaigns/[id]/page-content` | Save draft block tree (zod validated) |
| PATCH | `/api/admin/campaigns/[id]/form-settings` | Save form_settings |
| POST  | `/api/admin/campaigns/[id]/publish` | Copy draft → published, revalidate |
| POST  | `/api/admin/campaigns/[id]/preview-token` | Create/rotate token |
| POST  | `/api/admin/campaigns/[id]/assets` | Upload → Storage + row; returns assetId + public_url |
| DELETE| `/api/admin/campaigns/[id]/assets/[assetId]` | Reject if referenced in page_content/published_content |
| GET   | `/api/public/campaigns/[slug]/progress` | Aggregate for FundraisingProgress (ISR 60s) |

All admin endpoints: auth + org_id check + audit log entry.

## 10. Rendering

- `app/(public)/campaigns/[slug]/page.tsx` — server component; reads `published_content`; renders via `<BlockRenderer />` which looks up `blockRegistry[type]`. Unknown types skipped.
- `app/(public)/campaigns/[slug]/preview/page.tsx` — validates token, renders `page_content`, forces `noindex`.
- Block components are server components by default; only DonationQuickForm and SNSShare are client components.
- Cache: ISR with tag `campaign:<slug>`; publish invalidates.

## 11. Schemas & Code Layout

```
src/
  lib/
    campaign-builder/
      blocks/
        schema.ts           # per-block zod + discriminated union
        registry.tsx        # type → server component mapping
      form-settings/
        schema.ts
      publish.ts            # draft→published copy + revalidate
      preview-token.ts      # generate/verify
      assets.ts             # upload, mime/size guard, DOMPurify for SVG
  components/
    campaign-builder/
      Editor.tsx
      CanvasRenderer.tsx
      BlockToolbar.tsx
      PropsPanel.tsx
      palette/
        BlockCard.tsx
      inputs/
        AssetUploadField.tsx
        RichTextField.tsx
    campaign-blocks/
      Hero.tsx
      RichText.tsx
      ImageSingle.tsx
      ImpactStats.tsx
      FundraisingProgress.tsx
      Faq.tsx
      DonationQuickForm.tsx
      SnsShare.tsx
  app/
    (admin)/admin/campaigns/[id]/edit/page.tsx
    (public)/campaigns/[slug]/page.tsx
    (public)/campaigns/[slug]/preview/page.tsx
    donate/wizard/page.tsx
    api/admin/campaigns/[id]/(page-content|form-settings|publish|preview-token|assets)/...
    api/public/campaigns/[slug]/progress/route.ts
supabase/migrations/
  2026xxxx_campaign_builder.sql
  2026xxxx_campaign_assets.sql
  2026xxxx_payments_designation.sql
  2026xxxx_receipts_rrn_encryption.sql
  2026xxxx_storage_campaign_assets.sql
```

## 12. Migration & Backfill

1. Add columns to `campaigns`, `payments` (nullable, safe default).
2. Create `campaign_assets` + RLS.
3. Create Storage bucket `campaign-assets` with policies.
4. Backfill existing campaigns:
   - `page_content = { meta:{schemaVersion:1}, blocks:[{ id, type:"richText", props:{ html: description } }] }` if `description` is non-empty.
   - `form_settings` = defaults that reproduce current donation-form behavior (preset amounts from existing code, all existing methods enabled, `requireReceipt=false`).
   - `published_content = page_content`, `published_at = now()` for campaigns currently with `status='published'`.
5. Leave existing `/campaigns/[slug]` route in place until new renderer is ready; swap atomically via PR.

## 13. Testing

- **Unit (vitest)**: each block's zod schema (valid/invalid), form_settings schema, publish copy semantics, preview token verify, asset mime/size guard, DOMPurify on richText.
- **Integration (vitest + Supabase test project)**: PATCH page-content → read-back equality; publish → published_content matches; RLS blocks cross-org access; asset delete blocked when referenced.
- **E2E (Playwright)**:
  1. Admin login → add Hero/RichText/FundraisingProgress/DonationQuickForm → reorder → autosave → publish → `/campaigns/[slug]` renders.
  2. Quickform submit → wizard Step 1 prefilled.
  3. Wizard 3-step happy path (card, 일시) → payment row created with `designation` + `custom_fields`.
  4. Preview token: valid shows draft; invalid/rotated → 404.

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Schema drift between draft and renderer | Single zod source of truth; `schemaVersion` field; unknown-type skip |
| XSS via RichText/SVG assets | DOMPurify on save and on render; SVG allowed only after sanitization |
| Public exposure of unpublished drafts | Publish endpoint is the only writer of `published_content`; preview requires token; preview pages force noindex |
| Asset orphaning / accidental deletion | Reject delete when referenced; nightly cleanup job (Phase 2) for truly orphaned assets |
| Wizard regressions on payment | Reuse existing lib/toss and webhook; contract tests for `/api/donations/confirm` unchanged |
| Encrypted RRN key management | Reuse `org_secrets` pattern; never log; decrypt only at receipt issuance; nightly purge after 5-year retention |

## 15. Phase 2 Backlog (out of this spec)

- 휴대폰 본인인증 (KG/NICE) + 전자서명 pad + 14세 미만 보호자동의 + 이체일 선택 (금융결제원 CMS direct)
- Undo/redo + `campaign_page_versions` history & rollback
- Additional blocks: VideoEmbed, QuoteStory, Testimonial, LogoCloud, StickyCTABar
- 2-column variants inside blocks
- P2P fundraising pages
- Template library (pre-built block compositions)

## 16. Acceptance Criteria

- An admin can create a campaign, assemble a landing page using the 8 blocks, configure `form_settings`, preview via token, and publish. Public `/campaigns/[slug]` renders the published content.
- A visitor can submit the Quick Form on the landing page, proceed through the 3-step wizard, complete a Toss card payment (일시) and a Toss billingKey regular subscription (정기), and see their payment recorded with correct `campaign_id`, `designation`, `custom_fields`.
- Draft edits do not affect public page until publish.
- Cross-org access is blocked at API and RLS layers.
- All admin mutations create audit log entries.
