# Gap Analysis & Enhancement Roadmap

- **Date**: 2026-04-16
- **Status**: Reference document (not an implementation spec)
- **Relation**: Companion to `2026-04-16-donation-site-builder-design.md`. The builder consumes the top priority; this document tracks everything else.

## Current Implementation Snapshot

| Area | Status |
|---|---|
| Public landing, campaign list/detail | ✅ |
| Toss Payments (card / CMS billingKey / naverpay / kakaopay / virtual) | ✅ |
| Donor self-service (signup, profile, promises, payments, receipts) | ✅ |
| Offline payment (가상계좌, 지로, 무통장) manual entry | ✅ |
| Receipts (PDF via pdfmake, bulk issue, Storage persistence) | ✅ |
| Admin dashboard (KPIs, recent payments) | ✅ |
| Campaign CRUD (basic title/desc/goal) | ✅ |
| ERP API v1 (GET payments list, PATCH status) | ✅ |
| Post-payment SMS/email audit | ✅ |
| CRON (regular debit, unpaid reminders) | ✅ |
| Audit logs | ✅ |
| Admin bootstrap + seed | ✅ |
| Donor/payment CSV export & import | ✅ |

## Gaps Against Requirements

### ⛔ Critical — being addressed now
- **Campaign page builder (요구사항서 §4.1)** — subject of `2026-04-16-donation-site-builder-design.md`.

### 🔶 High priority (Phase 2)

| Item | Why it matters | Dependency | Rough size |
|---|---|---|---|
| **P2P fundraising pages** | Requirements §4.1 lists this explicitly. Lets donors create personal pages to share with their network; drives organic acquisition. | Builder shipped (reuses block renderer + form_settings inheritance) | M (2–3 wks) |
| **국세청 연말정산 간소화 전산매체 파일 생성** | Mandatory for 지정기부금 단체 compliance. Currently PDF receipts only. | Receipt schema already has RRN encryption path (to be completed in builder wizard). | M (2 wks) |
| **Automation rules UI** (conditional SMS/email triggers) | §6 요구사항. Today only manual SMS from admin and CRON reminders. | Email/SMS adapters exist (Resend + audit module); need rules engine and admin UI. | L (3–4 wks) |
| **Email template library** | Reusable welcome / receipt / unpaid / annual-report templates per org. | Resend already integrated. | S (1 wk) |
| **Role-based permission granularity** (본부 / 지부 / 담당자) | Multi-unit orgs (지부) cannot isolate donor/campaign access today. | Requires `org_unit` table + RLS extension; members.role enum expansion. | L (3–4 wks) |
| **휴대폰 본인인증 + 전자서명 + 14세 미만 보호자동의 + 이체일 선택** | Required only if org drops Toss billingKey and contracts 금융결제원 CMS directly. | KG/NICE PG contract; legal review of e-signature. | L (4–6 wks) |

### 🟡 Medium priority (Phase 3)

| Item | Why it matters | Rough size |
|---|---|---|
| **ERP Push webhooks** | Current ERP API is pull-only. Push needed for near-real-time ERP sync. | S–M (1–2 wks) |
| **Custom fields registry at org level** | Currently per-campaign. Some orgs want a global 30-field schema. | M (2 wks) |
| **Template library for campaigns** | Starter block compositions (정기결연 / 긴급구호 / 굿즈연계). | S (1 wk) |
| **Undo/Redo + version history for builder** | Quality-of-life + audit. Requires `campaign_page_versions`. | M (2 wks) |
| **Donor communications log UI** (상담 이력) | §4 요구사항 "후원자 문의 응대". | M (2 wks) |

### 🟢 Nice-to-have (Phase 4+)

| Item | Note |
|---|---|
| AI 이탈 예측 (churn model) | Needs ≥12 months of payment history; model + batch job. |
| Mobile app (donor) | Web is mobile-first; app only if org demands. |
| Multi-currency / overseas donors | Only if org runs overseas campaigns. |
| Accessibility audit (WCAG 2.1 AA) on public pages | Should run after builder ships; mostly content-driven. |

## Suggested Sequencing

1. **Now**: Donation Site Builder MVP (separate spec).
2. **Next (Phase 2)**: P2P fundraising + Email template library + 국세청 전산매체 — these share infrastructure touched by the builder (block renderer, receipt path, email engine).
3. **Then**: Automation rules UI + role granularity — larger, cross-cutting; do after Phase 2 usage gives signal.
4. **Later**: ERP push, version history, advanced custom fields.
5. **Opportunistic**: AI churn, accessibility audit.

## Notes

- Each Phase-2/3 item will get its own design spec when it enters the queue. This document only captures priority and rough size so the team can sequence.
- Sizes are rough order-of-magnitude for a single engineer and do not account for QA/design bandwidth.
