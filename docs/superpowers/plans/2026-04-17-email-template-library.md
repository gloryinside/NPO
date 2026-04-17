# Email Template Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 Tiptap WYSIWYG 에디터로 6개 시나리오별 이메일 템플릿을 편집하고, 변수 치환 + 기관 테마 반영 + 실시간 미리보기를 제공하며, 기존 발송 로직에 자동 통합한다.

**Architecture:** `email_templates` DB 테이블에 Tiptap JSON을 저장. `template-renderer.ts`가 JSON → 인라인 CSS 이메일 HTML 변환 + 변수 치환 + 기관 테마 래핑. `resolve-template.ts`가 DB 조회 → 커스텀 or 기본 폴백 → 렌더링. 기존 `email.ts`의 각 함수 내부에서 `resolveTemplate()` 호출로 교체.

**Tech Stack:** Next.js App Router, Supabase, Tiptap (`@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`), Resend, TypeScript, Tailwind CSS

---

## File Map

### 신규 생성
| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260417500001_email_templates.sql` | email_templates 테이블 + RLS |
| `src/lib/email/default-templates.ts` | 6개 시나리오별 기본 Tiptap JSON + subject |
| `src/lib/email/template-renderer.ts` | Tiptap JSON → 인라인 CSS 이메일 HTML + 변수 치환 + 테마 래핑 |
| `src/lib/email/resolve-template.ts` | DB 조회 → 폴백 → 렌더링 → {subject, html} |
| `src/app/api/admin/email-templates/route.ts` | GET (목록), PUT (저장) |
| `src/app/api/admin/email-templates/preview/route.ts` | POST (미리보기 렌더링) |
| `src/app/api/admin/email-templates/test-send/route.ts` | POST (테스트 발송) |
| `src/app/(admin)/admin/email-templates/page.tsx` | 시나리오 카드 그리드 목록 |
| `src/app/(admin)/admin/email-templates/[scenario]/page.tsx` | 에디터 페이지 wrapper |
| `src/components/admin/email-template-editor.tsx` | Tiptap 에디터 + 변수 삽입 + 미리보기 `'use client'` |

### 수정
| 파일 | 변경 |
|---|---|
| `src/lib/email.ts` | 각 함수 내부에서 resolveTemplate 호출, orgId 파라미터 추가 |
| `src/lib/notifications/send.ts` | orgId 전달 추가 |
| `src/lib/donations/confirm.ts` | orgId를 notifyDonationThanks에 전달 |
| `src/app/api/donations/prepare/route.ts` | orgId를 sendOfflineDonationReceived에 전달 |
| `src/components/admin/sidebar.tsx` | 설정 그룹에 "이메일 템플릿" 메뉴 추가 |

---

## Phase 1 — DB + 렌더러 코어

---

### Task 1: email_templates 마이그레이션

**Files:**
- Create: `supabase/migrations/20260417500001_email_templates.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
CREATE TABLE IF NOT EXISTS email_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  scenario     TEXT NOT NULL,
  subject      TEXT NOT NULL,
  body_json    JSONB NOT NULL,
  body_html    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, scenario)
);

CREATE INDEX idx_email_templates_org ON email_templates(org_id);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON email_templates
  FOR ALL USING (
    org_id = (SELECT org_id FROM admin_users WHERE supabase_uid = auth.uid() LIMIT 1)
  );

COMMENT ON TABLE email_templates IS '기관별 이메일 템플릿. Tiptap JSON 기반, 시나리오별 1개.';
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/20260417500001_email_templates.sql
git commit -m "feat(db): email_templates 테이블 + RLS 마이그레이션"
```

---

### Task 2: 기본 템플릿 정의

**Files:**
- Create: `src/lib/email/default-templates.ts`

- [ ] **Step 1: 기본 템플릿 모듈 작성**

```typescript
// src/lib/email/default-templates.ts

/**
 * 시나리오별 기본 Tiptap JSON + subject.
 * DB에 커스텀 템플릿이 없을 때 폴백으로 사용.
 */

export type ScenarioKey =
  | 'donation_thanks'
  | 'offline_received'
  | 'receipt_issued'
  | 'billing_failed'
  | 'billing_reminder'
  | 'welcome';

export type VariableDef = { key: string; label: string; sample: string };

export type ScenarioMeta = {
  key: ScenarioKey;
  label: string;
  description: string;
  variables: VariableDef[];
  defaultSubject: string;
  defaultBodyJson: Record<string, unknown>;
};

function p(text: string): Record<string, unknown> {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function heading(text: string, level = 2): Record<string, unknown> {
  return { type: 'heading', attrs: { level }, content: [{ type: 'text', text }] };
}

function bold(text: string): Record<string, unknown> {
  return { type: 'text', text, marks: [{ type: 'bold' }] };
}

function textNode(text: string): Record<string, unknown> {
  return { type: 'text', text };
}

function pMixed(...nodes: Record<string, unknown>[]): Record<string, unknown> {
  return { type: 'paragraph', content: nodes };
}

export const SCENARIOS: ScenarioMeta[] = [
  {
    key: 'donation_thanks',
    label: '후원 완료 감사',
    description: '결제 완료 시 후원자에게 발송되는 감사 이메일',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'amount', label: '후원 금액', sample: '50,000원' },
      { key: 'type', label: '후원 유형', sample: '일시' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'campaignTitle', label: '캠페인명', sample: '아동교육 지원' },
      { key: 'paymentCode', label: '결제번호', sample: 'PAY-20260417-001' },
      { key: 'date', label: '결제일', sample: '2026. 4. 17.' },
    ],
    defaultSubject: '[{{orgName}}] 후원 완료 — {{amount}}',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('후원해 주셔서 감사합니다'),
        pMixed(bold('{{name}}'), textNode('��, {{orgName}}에 소중한 후원을 해주셔서 진심으로 감사드립니다.')),
        p('아래는 후원 내역입니다.'),
        pMixed(textNode('캠페인: '), bold('{{campaignTitle}}')),
        pMixed(textNode('후원 유형: '), bold('{{type}} 후원')),
        pMixed(textNode('후원 금액: '), bold('{{amount}}')),
        pMixed(textNode('결제일: '), bold('{{date}}')),
        pMixed(textNode('결제번호: {{paymentCode}}')),
        p('따뜻한 나눔에 다시 한번 감사드립니다.'),
      ],
    },
  },
  {
    key: 'offline_received',
    label: '오프라인 접수 안내',
    description: '계좌이체/CMS 후원 신청 접수 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'amount', label: '후원 금액', sample: '30,000원' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'campaignTitle', label: '캠페인명', sample: '아동교육 지원' },
      { key: 'paymentCode', label: '접수번호', sample: 'PAY-20260417-002' },
      { key: 'payMethod', label: '결제수단', sample: '계좌이체' },
      { key: 'bankName', label: '은행명', sample: '국민은행' },
      { key: 'bankAccount', label: '계좌번호', sample: '123-456-789012' },
      { key: 'accountHolder', label: '예금주', sample: '희망나눔재단' },
    ],
    defaultSubject: '[{{orgName}}] {{payMethod}} 후원 신청이 접수되었습니다',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('후원 신청이 접수되었습니다'),
        pMixed(bold('{{name}}'), textNode('님의 {{payMethod}} 후원 신청이 정상적으로 접수되었습니다.')),
        pMixed(textNode('캠페인: '), bold('{{campaignTitle}}')),
        pMixed(textNode('신청 금액: '), bold('{{amount}}')),
        pMixed(textNode('접수번호: {{paymentCode}}')),
        p('은행: {{bankName}}'),
        p('계좌번호: {{bankAccount}}'),
        p('예금주: {{accountHolder}}'),
        p('입금 시 이름(후원자명)을 기재해 주세요. 입금 확인 후 후원이 처리됩니다.'),
      ],
    },
  },
  {
    key: 'receipt_issued',
    label: '영수증 발급 완료',
    description: '기부금 영수증 발급 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'year', label: '귀속연도', sample: '2025' },
      { key: 'totalAmount', label: '기부 합계', sample: '600,000원' },
      { key: 'receiptCode', label: '영수증 번호', sample: 'RCP-2025-001' },
      { key: 'pdfUrl', label: 'PDF 링크', sample: 'https://example.com/receipt.pdf' },
    ],
    defaultSubject: '[{{orgName}}] {{year}}년 기부금 영수증 발급 완료',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('기부금 영수증이 발급되었습니다'),
        pMixed(bold('{{name}}'), textNode('님, {{year}}년 기부금 영수증이 발급되었습니다.')),
        pMixed(textNode('기부 합계: '), bold('{{totalAmount}}')),
        pMixed(textNode('영수증 번호: {{receiptCode}}')),
        p('아래 링���에서 PDF를 다운로드하실 수 있습니다.'),
        p('{{pdfUrl}}'),
      ],
    },
  },
  {
    key: 'billing_failed',
    label: '자동결제 실패',
    description: '정기후원 자동결제 실패 시 후원자에게 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'amount', label: '결제 금액', sample: '50,000원' },
      { key: 'reason', label: '실패 사유', sample: '카드 한도 초과' },
    ],
    defaultSubject: '[{{orgName}}] 자동결제 실패 안내',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('자동결제가 실패했습니다'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}} 정기후원 자동결제가 실패했습니다.')),
        pMixed(textNode('결제 금액: '), bold('{{amount}}')),
        pMixed(textNode('실패 사유: {{reason}}')),
        p('카드 정보를 확인하시거나, 기관으로 문의해 주세요.'),
      ],
    },
  },
  {
    key: 'billing_reminder',
    label: '결제 예정 안내',
    description: '정기후원 결제 D-3 사전 안내',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
      { key: 'amount', label: '결제 금액', sample: '50,000원' },
      { key: 'date', label: '결제 예정일', sample: '2026. 4. 20.' },
    ],
    defaultSubject: '[{{orgName}}] 정기후원 결제 예정 안내',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('결제 예정 안내'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}} 정기후원 결제가 예정되어 있습니다.')),
        pMixed(textNode('결제 예정일: '), bold('{{date}}')),
        pMixed(textNode('결제 금액: '), bold('{{amount}}')),
        p('계속적인 나눔에 감사드립니다.'),
      ],
    },
  },
  {
    key: 'welcome',
    label: '가입 환영',
    description: '신규 후원자 가입 시 발송',
    variables: [
      { key: 'name', label: '후원자명', sample: '홍길동' },
      { key: 'orgName', label: '기관명', sample: '희망나눔재단' },
    ],
    defaultSubject: '[{{orgName}}] 환영합니다, {{name}}님!',
    defaultBodyJson: {
      type: 'doc',
      content: [
        heading('환영합니다!'),
        pMixed(bold('{{name}}'), textNode('님, {{orgName}}에 오신 것을 환영합니다.')),
        p('앞으로 따뜻한 나눔의 여정을 함께해 주세요.'),
        p('궁금한 점이 있으시면 언제든 문의해 주세요.'),
      ],
    },
  },
];

export function getScenario(key: ScenarioKey): ScenarioMeta {
  const found = SCENARIOS.find((s) => s.key === key);
  if (!found) throw new Error(`Unknown email scenario: ${key}`);
  return found;
}

export function getSampleVariables(key: ScenarioKey): Record<string, string> {
  const scenario = getScenario(key);
  const map: Record<string, string> = {};
  for (const v of scenario.variables) {
    map[v.key] = v.sample;
  }
  return map;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/email/default-templates.ts
git commit -m "feat(email): 6개 시나리오 기본 Tiptap JSON 템플릿 정의"
```

---

### Task 3: Tiptap JSON → 이메일 HTML 렌더러

**Files:**
- Create: `src/lib/email/template-renderer.ts`

- [ ] **Step 1: 렌더러 모듈 작성**

```typescript
// src/lib/email/template-renderer.ts

/**
 * Tiptap JSON → 인라인 CSS 이메일 HTML 변환기.
 * 1. JSON 재귀 순회 → HTML 생성
 * 2. {{variable}} 치환
 * 3. 기관 테마(accent, logo) 래핑
 */

type TiptapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TiptapNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
};

type ThemeInput = {
  accent?: string;
  logoUrl?: string | null;
  orgName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
};

// ── 노드 → HTML 변환 ────────────────────────────────────

function renderMarks(text: string, marks?: TiptapNode['marks']): string {
  let out = escapeHtml(text);
  if (!marks) return out;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
        out = `<strong>${out}</strong>`;
        break;
      case 'italic':
        out = `<em>${out}</em>`;
        break;
      case 'link': {
        const href = (mark.attrs?.href as string) ?? '#';
        out = `<a href="${escapeHtml(href)}" style="color:inherit;text-decoration:underline">${out}</a>`;
        break;
      }
    }
  }
  return out;
}

function renderNode(node: TiptapNode, accent: string): string {
  switch (node.type) {
    case 'doc':
      return (node.content ?? []).map((n) => renderNode(n, accent)).join('');

    case 'paragraph':
      return `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#333">${renderChildren(node, accent)}</p>`;

    case 'heading': {
      const level = (node.attrs?.level as number) ?? 2;
      const size = level === 2 ? '20px' : '16px';
      return `<h${level} style="margin:0 0 12px;font-size:${size};color:#111">${renderChildren(node, accent)}</h${level}>`;
    }

    case 'bulletList':
      return `<ul style="margin:0 0 12px;padding-left:20px">${renderChildren(node, accent)}</ul>`;

    case 'orderedList':
      return `<ol style="margin:0 0 12px;padding-left:20px">${renderChildren(node, accent)}</ol>`;

    case 'listItem':
      return `<li style="margin:0 0 4px">${renderChildren(node, accent)}</li>`;

    case 'hardBreak':
      return '<br>';

    case 'text':
      return renderMarks(node.text ?? '', node.marks);

    default:
      // Unknown node type → graceful skip
      return node.content ? renderChildren(node, accent) : '';
  }
}

function renderChildren(node: TiptapNode, accent: string): string {
  return (node.content ?? []).map((n) => renderNode(n, accent)).join('');
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── 변수 치환 ─────────────────────────────────────────────

export function substituteVariables(
  text: string,
  variables: Record<string, string>
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? `{{${key}}}`);
}

// ── 테마 래핑 ─────────────────────────────────────────────

function wrapWithTheme(bodyHtml: string, theme: ThemeInput): string {
  const accent = theme.accent ?? '#7c3aed';
  const logo = theme.logoUrl
    ? `<img src="${escapeHtml(theme.logoUrl)}" alt="${escapeHtml(theme.orgName)}" style="max-height:48px;width:auto;margin-bottom:16px" />`
    : '';
  const orgTitle = `<div style="font-size:18px;font-weight:700;color:${accent};margin-bottom:4px">${escapeHtml(theme.orgName)}</div>`;

  const contactParts: string[] = [];
  if (theme.contactPhone) contactParts.push(`전화: ${escapeHtml(theme.contactPhone)}`);
  if (theme.contactEmail) contactParts.push(`이메일: ${escapeHtml(theme.contactEmail)}`);
  const contactLine = contactParts.length > 0 ? `<div style="margin-top:4px">${contactParts.join(' | ')}</div>` : '';

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(theme.orgName)}</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:24px 0">
<tr><td align="center">
  <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:100%">
    <!-- Header -->
    <tr><td style="padding:24px 32px 16px;border-bottom:2px solid ${accent}">
      ${logo}${orgTitle}
    </td></tr>
    <!-- Body -->
    <tr><td style="padding:24px 32px 32px">
      ${bodyHtml}
    </td></tr>
    <!-- Footer -->
    <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">
      <div>본 메일은 발신 전용입니다.</div>
      ${contactLine}
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Public API ────────────────────────────────────────────

export function renderTemplate(
  bodyJson: Record<string, unknown>,
  variables: Record<string, string>,
  theme: ThemeInput
): string {
  const accent = theme.accent ?? '#7c3aed';
  const rawHtml = renderNode(bodyJson as TiptapNode, accent);
  const substituted = substituteVariables(rawHtml, variables);
  return wrapWithTheme(substituted, theme);
}

export function renderSubject(
  subjectTemplate: string,
  variables: Record<string, string>
): string {
  return substituteVariables(subjectTemplate, variables);
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/email/template-renderer.ts
git commit -m "feat(email): Tiptap JSON → 이메일 HTML 렌더러 + 변수 치환 + 테마 래핑"
```

---

### Task 4: 템플릿 리졸버

**Files:**
- Create: `src/lib/email/resolve-template.ts`

- [ ] **Step 1: 리졸버 모듈 작성**

```typescript
// src/lib/email/resolve-template.ts

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getScenario, type ScenarioKey } from './default-templates';
import { renderTemplate, renderSubject } from './template-renderer';

type ResolvedEmail = {
  subject: string;
  html: string;
};

type ThemeRow = {
  name: string;
  logo_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  theme_config: { accent?: string } | null;
};

export async function resolveTemplate(
  orgId: string,
  scenario: ScenarioKey,
  variables: Record<string, string>
): Promise<ResolvedEmail> {
  const supabase = createSupabaseAdminClient();

  // Parallel: fetch custom template + org theme
  const [templateRes, orgRes] = await Promise.all([
    supabase
      .from('email_templates')
      .select('subject, body_json, is_active')
      .eq('org_id', orgId)
      .eq('scenario', scenario)
      .maybeSingle(),
    supabase
      .from('orgs')
      .select('name, logo_url, contact_email, contact_phone, theme_config')
      .eq('id', orgId)
      .maybeSingle(),
  ]);

  const org = orgRes.data as ThemeRow | null;
  const theme = {
    accent: org?.theme_config?.accent,
    logoUrl: org?.logo_url,
    orgName: org?.name ?? variables.orgName ?? '',
    contactEmail: org?.contact_email,
    contactPhone: org?.contact_phone,
  };

  // Use custom template if exists and active
  const custom = templateRes.data;
  if (custom && custom.is_active) {
    return {
      subject: renderSubject(custom.subject as string, variables),
      html: renderTemplate(custom.body_json as Record<string, unknown>, variables, theme),
    };
  }

  // Fallback to default
  const defaults = getScenario(scenario);
  return {
    subject: renderSubject(defaults.defaultSubject, variables),
    html: renderTemplate(defaults.defaultBodyJson, variables, theme),
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/email/resolve-template.ts
git commit -m "feat(email): resolveTemplate — DB 커스텀 or 기본 폴백 리졸버"
```

---

## Phase 2 — 기존 발송 로직 통합

---

### Task 5: email.ts 리팩토링 (resolveTemplate 통합)

**Files:**
- Modify: `src/lib/email.ts`

- [ ] **Step 1: 각 발송 함수에 orgId 추가 + resolveTemplate 사용**

`src/lib/email.ts` 전체를 교체한다. 기존 `sendEmail()` (Resend 발송)과 `fromAddress()`는 유지. 각 시나리오 함수 내부의 하드코딩 HTML을 `resolveTemplate()` 호출로 교체.

```typescript
/**
 * Transactional email helpers via Resend.
 *
 * Set RESEND_API_KEY in environment. All sends are fire-and-forget:
 * a failed email never breaks the calling API route.
 */

import { resolveTemplate } from '@/lib/email/resolve-template';
import type { ScenarioKey } from '@/lib/email/default-templates';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "";

function fromAddress(orgName?: string): string {
  const label = orgName ? `${orgName} 후원 알림` : "후원 알림";
  const addr = BASE_DOMAIN ? `noreply@${BASE_DOMAIN}` : "onboarding@resend.dev";
  return `${label} <${addr}>`;
}

type SendOptions = {
  to: string;
  subject: string;
  html: string;
  from?: string;
};

async function sendEmail(opts: SendOptions): Promise<void> {
  if (!RESEND_API_KEY) {
    console.warn("[email] RESEND_API_KEY not set — skipping email send.");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: opts.from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function fmt(n: number): string {
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

async function sendViaTemplate(
  orgId: string,
  scenario: ScenarioKey,
  variables: Record<string, string>,
  to: string,
  orgName: string,
): Promise<void> {
  const { subject, html } = await resolveTemplate(orgId, scenario, variables);
  await sendEmail({ from: fromAddress(orgName), to, subject, html });
}

// ─── Public API ──────────────────────────────────────────────────────────────

export type DonationConfirmedParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  campaignTitle: string | null;
  amount: number;
  paymentCode: string;
  approvedAt: string | null;
};

export function sendDonationConfirmed(params: DonationConfirmedParams): void {
  const { orgId, to, memberName, orgName, campaignTitle, amount, paymentCode, approvedAt } = params;
  const dateStr = approvedAt
    ? new Date(approvedAt).toLocaleDateString("ko-KR")
    : new Date().toLocaleDateString("ko-KR");

  sendViaTemplate(orgId, 'donation_thanks', {
    name: memberName,
    amount: fmt(amount),
    type: '일시',
    orgName,
    campaignTitle: campaignTitle ?? '일반 후원',
    paymentCode,
    date: dateStr,
  }, to, orgName).catch((err) => {
    console.error("[email] sendDonationConfirmed failed:", err);
  });
}

export type OfflineDonationReceivedParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  campaignTitle: string | null;
  amount: number;
  paymentCode: string;
  payMethod: "transfer" | "cms" | "manual";
  donationType: "onetime" | "regular";
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
};

export function sendOfflineDonationReceived(params: OfflineDonationReceivedParams): void {
  const { orgId, to, memberName, orgName, campaignTitle, amount, paymentCode, payMethod, bankName, bankAccount, accountHolder } = params;
  const methodLabel = payMethod === "cms" ? "CMS 자동이체" : "계좌이체";

  sendViaTemplate(orgId, 'offline_received', {
    name: memberName,
    amount: fmt(amount),
    orgName,
    campaignTitle: campaignTitle ?? '일반 후원',
    paymentCode,
    payMethod: methodLabel,
    bankName: bankName ?? '',
    bankAccount: bankAccount ?? '',
    accountHolder: accountHolder ?? '',
  }, to, orgName).catch((err) => {
    console.error("[email] sendOfflineDonationReceived failed:", err);
  });
}

export type ReceiptIssuedParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  year: number;
  totalAmount: number;
  receiptCode: string;
  pdfUrl: string | null;
};

export function sendReceiptIssued(params: ReceiptIssuedParams): void {
  const { orgId, to, memberName, orgName, year, totalAmount, receiptCode, pdfUrl } = params;

  sendViaTemplate(orgId, 'receipt_issued', {
    name: memberName,
    orgName,
    year: String(year),
    totalAmount: fmt(totalAmount),
    receiptCode,
    pdfUrl: pdfUrl ?? '마이페이지에서 확인',
  }, to, orgName).catch((err) => {
    console.error("[email] sendReceiptIssued failed:", err);
  });
}

export type BillingFailedEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  amount: number;
  reason: string;
};

export function sendBillingFailedEmail(params: BillingFailedEmailParams): void {
  const { orgId, to, memberName, orgName, amount, reason } = params;

  sendViaTemplate(orgId, 'billing_failed', {
    name: memberName,
    orgName,
    amount: fmt(amount),
    reason,
  }, to, orgName).catch((err) => {
    console.error("[email] sendBillingFailedEmail failed:", err);
  });
}

export type BillingReminderEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
  amount: number;
  date: string;
};

export function sendBillingReminderEmail(params: BillingReminderEmailParams): void {
  const { orgId, to, memberName, orgName, amount, date } = params;

  sendViaTemplate(orgId, 'billing_reminder', {
    name: memberName,
    orgName,
    amount: fmt(amount),
    date,
  }, to, orgName).catch((err) => {
    console.error("[email] sendBillingReminderEmail failed:", err);
  });
}

export type WelcomeEmailParams = {
  orgId: string;
  to: string;
  memberName: string;
  orgName: string;
};

export function sendWelcomeEmail(params: WelcomeEmailParams): void {
  const { orgId, to, memberName, orgName } = params;

  sendViaTemplate(orgId, 'welcome', {
    name: memberName,
    orgName,
  }, to, orgName).catch((err) => {
    console.error("[email] sendWelcomeEmail failed:", err);
  });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/email.ts
git commit -m "refactor(email): resolveTemplate 통합 — 하드코딩 HTML 제거, orgId 파라미터 추가"
```

---

### Task 6: 호출부 orgId 전달 수정

**Files:**
- Modify: `src/lib/notifications/send.ts`
- Modify: `src/app/api/donations/prepare/route.ts`

- [ ] **Step 1: notifications/send.ts에 orgId 추가**

각 Params 타입에 `orgId: string` 추가. 이메일 발송 호출에 `orgId` 전달.

`DonationThanksParams`에 `orgId: string` 추가:
```typescript
export type DonationThanksParams = {
  orgId: string;
  phone: string | null;
  email: string | null;
  name: string;
  amount: number;
  type: 'onetime' | 'regular';
  orgName: string;
  campaignTitle: string | null;
  paymentCode: string;
  approvedAt: string | null;
};
```

`notifyDonationThanks` 이메일 호출부:
```typescript
  if (email) {
    sendDonationConfirmed({ orgId, to: email, memberName: name, orgName, campaignTitle, amount, paymentCode, approvedAt });
  }
```

`ReceiptIssuedParams`에 `orgId: string` 추가:
```typescript
export type ReceiptIssuedParams = {
  orgId: string;
  phone: string | null;
  email: string | null;
  name: string;
  year: number;
  pdfUrl: string | null;
  orgName: string;
  receiptCode: string;
  totalAmount: number;
};
```

`notifyReceiptIssued` 이메일 호출부:
```typescript
  if (email) {
    sendReceiptEmail({ orgId, to: email, memberName: name, orgName, year, receiptCode, totalAmount, pdfUrl });
  }
```

`BillingFailedParams`에 `orgId: string` 추가:
```typescript
export type BillingFailedParams = {
  orgId: string;
  phone: string | null;
  name: string;
  amount: number;
  reason: string;
  orgName: string;
};
```

`BillingUpcomingParams`에 `orgId: string` 추가:
```typescript
export type BillingUpcomingParams = {
  orgId: string;
  phone: string | null;
  name: string;
  date: string;
  amount: number;
  orgName: string;
};
```

- [ ] **Step 2: confirm.ts 호출부 수정**

`src/lib/donations/confirm.ts`의 `sendDonationConfirmedEmail` 내 `notifyDonationThanks` 호출에 `orgId: payment.org_id` 추가:

```typescript
    notifyDonationThanks({
      orgId: payment.org_id,
      phone: memberRes.data?.phone ?? null,
      email: memberEmail,
      name: memberRes.data?.name ?? '후원자',
      amount: Number(payment.amount),
      type: payType,
      orgName: orgRes.data?.name ?? '',
      campaignTitle: campaignRes.data?.title ?? null,
      paymentCode: payment.payment_code,
      approvedAt: payment.approved_at,
    });
```

- [ ] **Step 3: prepare/route.ts 호출부 수정**

`src/app/api/donations/prepare/route.ts`의 `sendOfflineDonationReceived` 호출에 `orgId: tenant.id` 추가:

```typescript
      sendOfflineDonationReceived({
        orgId: tenant.id,
        to: email,
        memberName: memberName.trim(),
        orgName: org?.name ?? tenant.name,
        campaignTitle: campaign.title,
        amount,
        paymentCode: payment.payment_code,
        payMethod: (payMethod as "transfer" | "cms" | "manual") ?? "transfer",
        donationType: (donationType as "onetime" | "regular") ?? "onetime",
        bankName,
        bankAccount,
        accountHolder,
      });
```

- [ ] **Step 4: billing 알림 호출부에 orgId 전달**

`src/lib/billing/notifications.ts`에서 `notifyBillingFailed`, `notifyBillingUpcoming`(또는 동등한 함수) 호출 시 `orgId` 추가. `grep`으로 호출부를 확인하고 추가:

```bash
grep -rn "notifyBillingFailed\|notifyBillingUpcoming" src/lib/billing/ src/app/api/cron/
```

각 호출부에 `orgId` 필드를 추가한다.

- [ ] **Step 5: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 6: 커밋**

```bash
git add src/lib/notifications/send.ts src/lib/donations/confirm.ts 'src/app/api/donations/prepare/route.ts' src/lib/billing/
git commit -m "refactor: 이메일 발송 호출부 orgId 전달 추가"
```

---

## Phase 3 — 관리자 API

---

### Task 7: 이메일 템플릿 CRUD API

**Files:**
- Create: `src/app/api/admin/email-templates/route.ts`

- [ ] **Step 1: GET + PUT API 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS } from '@/lib/email/default-templates';
import { renderTemplate, renderSubject } from '@/lib/email/template-renderer';

export async function GET() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: customs } = await supabase
    .from('email_templates')
    .select('scenario, subject, is_active, updated_at')
    .eq('org_id', tenant.id);

  const customMap = new Map(
    (customs ?? []).map((c) => [c.scenario, c])
  );

  const list = SCENARIOS.map((s) => {
    const custom = customMap.get(s.key);
    return {
      scenario: s.key,
      label: s.label,
      description: s.description,
      isCustom: !!custom,
      isActive: custom?.is_active ?? true,
      updatedAt: custom?.updated_at ?? null,
    };
  });

  return NextResponse.json(list);
}

export async function PUT(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const body = await req.json();
  const { scenario, subject, bodyJson } = body as {
    scenario: string;
    subject: string;
    bodyJson: Record<string, unknown>;
  };

  if (!scenario || !subject || !bodyJson) {
    return NextResponse.json({ error: '필수 필드 누락' }, { status: 400 });
  }

  // 유효한 시나리오인지 확인
  const meta = SCENARIOS.find((s) => s.key === scenario);
  if (!meta) {
    return NextResponse.json({ error: '알 수 없는 시나리오' }, { status: 400 });
  }

  // body_json 최소 검증: doc 타입 + content 1개 이상
  const doc = bodyJson as { type?: string; content?: unknown[] };
  if (doc.type !== 'doc' || !doc.content || doc.content.length === 0) {
    return NextResponse.json({ error: '템플릿 내용이 비어있습니다.' }, { status: 400 });
  }

  // org theme for HTML cache
  const { data: org } = await supabase
    .from('orgs')
    .select('name, logo_url, contact_email, contact_phone, theme_config')
    .eq('id', tenant.id)
    .maybeSingle();

  const theme = {
    accent: (org?.theme_config as { accent?: string } | null)?.accent,
    logoUrl: org?.logo_url ?? null,
    orgName: org?.name ?? '',
    contactEmail: org?.contact_email ?? null,
    contactPhone: org?.contact_phone ?? null,
  };

  // 샘플 변수로 HTML 캐시 생성
  const sampleVars: Record<string, string> = {};
  for (const v of meta.variables) sampleVars[v.key] = v.sample;
  const bodyHtml = renderTemplate(bodyJson, sampleVars, theme);

  const { error } = await supabase
    .from('email_templates')
    .upsert({
      org_id: tenant.id,
      scenario,
      subject,
      body_json: bodyJson,
      body_html: bodyHtml,
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'org_id,scenario' });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/admin/email-templates/route.ts
git commit -m "feat(api): 이메일 템플릿 CRUD API — GET 목록 + PUT 저장"
```

---

### Task 8: 미리보기 + 테스트 발송 API

**Files:**
- Create: `src/app/api/admin/email-templates/preview/route.ts`
- Create: `src/app/api/admin/email-templates/test-send/route.ts`

- [ ] **Step 1: 미리보기 API**

```typescript
// src/app/api/admin/email-templates/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSampleVariables } from '@/lib/email/default-templates';
import { renderTemplate, renderSubject } from '@/lib/email/template-renderer';
import type { ScenarioKey } from '@/lib/email/default-templates';

export async function POST(req: NextRequest) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { scenario, subject, bodyJson } = (await req.json()) as {
    scenario: ScenarioKey;
    subject: string;
    bodyJson: Record<string, unknown>;
  };

  const { data: org } = await supabase
    .from('orgs')
    .select('name, logo_url, contact_email, contact_phone, theme_config')
    .eq('id', tenant.id)
    .maybeSingle();

  const theme = {
    accent: (org?.theme_config as { accent?: string } | null)?.accent,
    logoUrl: org?.logo_url ?? null,
    orgName: org?.name ?? '',
    contactEmail: org?.contact_email ?? null,
    contactPhone: org?.contact_phone ?? null,
  };

  const sampleVars = getSampleVariables(scenario);
  const html = renderTemplate(bodyJson, sampleVars, theme);
  const renderedSubject = renderSubject(subject, sampleVars);

  return NextResponse.json({ subject: renderedSubject, html });
}
```

- [ ] **Step 2: 테스트 발송 API**

```typescript
// src/app/api/admin/email-templates/test-send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSampleVariables } from '@/lib/email/default-templates';
import { renderTemplate, renderSubject } from '@/lib/email/template-renderer';
import type { ScenarioKey } from '@/lib/email/default-templates';

export async function POST(req: NextRequest) {
  const adminUser = await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { scenario, subject, bodyJson } = (await req.json()) as {
    scenario: ScenarioKey;
    subject: string;
    bodyJson: Record<string, unknown>;
  };

  const { data: org } = await supabase
    .from('orgs')
    .select('name, logo_url, contact_email, contact_phone, theme_config')
    .eq('id', tenant.id)
    .maybeSingle();

  const theme = {
    accent: (org?.theme_config as { accent?: string } | null)?.accent,
    logoUrl: org?.logo_url ?? null,
    orgName: org?.name ?? '',
    contactEmail: org?.contact_email ?? null,
    contactPhone: org?.contact_phone ?? null,
  };

  const sampleVars = getSampleVariables(scenario);
  const html = renderTemplate(bodyJson, sampleVars, theme);
  const renderedSubject = renderSubject(subject, sampleVars);

  // 관리자 이메일로 발송
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY 미설정' }, { status: 500 });
  }

  const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? '';
  const fromAddr = BASE_DOMAIN
    ? `${org?.name ?? '후원'} 알림 <noreply@${BASE_DOMAIN}>`
    : 'Test <onboarding@resend.dev>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddr,
      to: adminUser.email,
      subject: `[테스트] ${renderedSubject}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `발송 실패: ${text}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sentTo: adminUser.email });
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/admin/email-templates/preview/route.ts src/app/api/admin/email-templates/test-send/route.ts
git commit -m "feat(api): 이메일 템플릿 미리보기 + 테스트 발송 API"
```

---

## Phase 4 — 관리자 UI

---

### Task 9: Tiptap 패키지 설치

**Files:** (none — package install)

- [ ] **Step 1: 패키지 설치**

```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link @tiptap/pm
```

- [ ] **Step 2: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: Tiptap 에디터 패키지 설치"
```

---

### Task 10: 이메일 템플릿 에디터 컴포넌트

**Files:**
- Create: `src/components/admin/email-template-editor.tsx`

- [ ] **Step 1: 에디터 컴포넌트 작성**

```typescript
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import type { ScenarioKey, VariableDef } from '@/lib/email/default-templates';

type Props = {
  scenario: ScenarioKey;
  label: string;
  variables: VariableDef[];
  initialSubject: string;
  initialBodyJson: Record<string, unknown>;
};

export function EmailTemplateEditor({ scenario, label, variables, initialSubject, initialBodyJson }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(initialSubject);
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [showVarDropdown, setShowVarDropdown] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false }),
    ],
    content: initialBodyJson,
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[300px] outline-none px-4 py-3 text-[var(--text)]',
      },
    },
  });

  const fetchPreview = useCallback(async (subj: string, json: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/admin/email-templates/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario, subject: subj, bodyJson: json }),
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewHtml(data.html);
      }
    } catch { /* ignore */ }
  }, [scenario]);

  // Debounced preview on editor changes
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchPreview(subject, editor.getJSON() as Record<string, unknown>);
      }, 500);
    };
    editor.on('update', handler);
    return () => { editor.off('update', handler); };
  }, [editor, subject, fetchPreview]);

  // Initial preview
  useEffect(() => {
    fetchPreview(initialSubject, initialBodyJson);
  }, [fetchPreview, initialSubject, initialBodyJson]);

  // Subject change triggers preview
  useEffect(() => {
    if (!editor) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(subject, editor.getJSON() as Record<string, unknown>);
    }, 500);
  }, [subject, editor, fetchPreview]);

  function insertVariable(varKey: string) {
    if (!editor) return;
    editor.chain().focus().insertContent(`{{${varKey}}}`).run();
    setShowVarDropdown(false);
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/email-templates', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario,
          subject,
          bodyJson: editor.getJSON(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error ?? '저장 실패' });
        return;
      }
      setMessage({ type: 'success', text: '저장되었습니다.' });
      router.refresh();
    } catch {
      setMessage({ type: 'error', text: '저장 중 오류 발생' });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('기본 템플릿으로 초기화하시겠습니까? 커스텀 내용이 사라집니다.')) return;
    if (!editor) return;
    editor.commands.setContent(initialBodyJson);
    setSubject(initialSubject);
    fetchPreview(initialSubject, initialBodyJson);
    setMessage({ type: 'success', text: '기본값으로 초기화되었습니다.' });
  }

  async function handleTestSend() {
    if (!editor) return;
    setMessage(null);
    try {
      const res = await fetch('/api/admin/email-templates/test-send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          scenario,
          subject,
          bodyJson: editor.getJSON(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? '발송 실패' });
        return;
      }
      setMessage({ type: 'success', text: `테스트 메일 발송 완료 (${data.sentTo})` });
    } catch {
      setMessage({ type: 'error', text: '발송 중 오류 발생' });
    }
  }

  if (!editor) return null;

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">{label}</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-6">이메일 템플릿 편집</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Editor — 3/5 */}
        <div className="lg:col-span-3 space-y-4">
          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">제목</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              title="이메일 제목"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] px-3 py-2 text-sm outline-none"
            />
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-1.5">
            <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="B" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="I" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="H2" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="H3" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="•" />
            <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="1." />
            <ToolbarButton onClick={() => {
              const url = prompt('링크 URL');
              if (url) editor.chain().focus().setLink({ href: url }).run();
            }} active={editor.isActive('link')} label="🔗" />
            <div className="w-px h-6 bg-[var(--border)] mx-1 self-center" />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowVarDropdown(!showVarDropdown)}
                className="px-2 py-1 text-xs rounded bg-[var(--accent)] text-white font-medium"
              >
                변수 삽입 ▾
              </button>
              {showVarDropdown && (
                <div className="absolute top-full left-0 mt-1 z-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg py-1 min-w-[180px]">
                  {variables.map((v) => (
                    <button
                      type="button"
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      className="w-full text-left px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--surface-2)] flex justify-between"
                    >
                      <span>{v.label}</span>
                      <span className="text-xs text-[var(--muted-foreground)] font-mono">{`{{${v.key}}}`}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Editor Content */}
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] min-h-[300px]">
            <EditorContent editor={editor} />
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-50">
              {saving ? '저장 중…' : '저장'}
            </button>
            <button type="button" onClick={handleReset} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] text-sm">
              기본값으로 초기화
            </button>
            <button type="button" onClick={handleTestSend} className="px-4 py-2 rounded-lg border border-[var(--border)] text-[var(--text)] text-sm">
              테스트 발송
            </button>
          </div>

          {message && (
            <div className={`text-sm px-3 py-2 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
              {message.text}
            </div>
          )}
        </div>

        {/* Preview — 2/5 */}
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-[var(--muted-foreground)] mb-1 block">미리보기</label>
          <div className="rounded-lg border border-[var(--border)] bg-white overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              title="이메일 미리보기"
              className="w-full border-0"
              style={{ minHeight: '500px' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarButton({ onClick, active, label }: { onClick: () => void; active: boolean; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-2 py-1 text-xs rounded font-medium transition-colors',
        active ? 'bg-[var(--accent)] text-white' : 'text-[var(--text)] hover:bg-[var(--surface)]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/admin/email-template-editor.tsx
git commit -m "feat(admin): Tiptap 이메일 템플릿 에디터 컴포넌트"
```

---

### Task 11: 템플릿 목록 페이지

**Files:**
- Create: `src/app/(admin)/admin/email-templates/page.tsx`

- [ ] **Step 1: 페이지 작성**

```typescript
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS } from '@/lib/email/default-templates';
import Link from 'next/link';

const ICONS: Record<string, string> = {
  donation_thanks: '💝',
  offline_received: '🏦',
  receipt_issued: '🧾',
  billing_failed: '⚠️',
  billing_reminder: '🔔',
  welcome: '👋',
};

export default async function EmailTemplatesPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: customs } = await supabase
    .from('email_templates')
    .select('scenario, is_active, updated_at')
    .eq('org_id', tenant.id);

  const customMap = new Map(
    (customs ?? []).map((c) => [c.scenario, c])
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[var(--text)] mb-1">이메일 템플릿</h1>
      <p className="text-sm text-[var(--muted-foreground)] mb-8">
        시나리오별 이메일 내용을 커스터마이징하세요.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {SCENARIOS.map((s) => {
          const custom = customMap.get(s.key);
          const isCustom = !!custom;
          const isActive = custom?.is_active ?? true;

          return (
            <Link
              key={s.key}
              href={`/admin/email-templates/${s.key}`}
              className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-transform duration-200 hover:scale-[1.02] hover:shadow-lg no-underline"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-2xl">{ICONS[s.key] ?? '📧'}</span>
                <div className="flex gap-1.5">
                  <span className={[
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    isCustom ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'bg-[var(--surface-2)] text-[var(--muted-foreground)]',
                  ].join(' ')}>
                    {isCustom ? '커스텀' : '기본'}
                  </span>
                  {!isActive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 font-medium">
                      비활성
                    </span>
                  )}
                </div>
              </div>
              <h3 className="text-sm font-semibold text-[var(--text)] mb-1">{s.label}</h3>
              <p className="text-xs text-[var(--muted-foreground)]">{s.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add 'src/app/(admin)/admin/email-templates/page.tsx'
git commit -m "feat(admin): 이메일 템플릿 목록 페이지 — 시나리오 카드 그리드"
```

---

### Task 12: 템플릿 에디터 페이지

**Files:**
- Create: `src/app/(admin)/admin/email-templates/[scenario]/page.tsx`

- [ ] **Step 1: 에디터 페이지 wrapper**

```typescript
import { notFound } from 'next/navigation';
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { SCENARIOS, type ScenarioKey } from '@/lib/email/default-templates';
import { EmailTemplateEditor } from '@/components/admin/email-template-editor';

export default async function EmailTemplateEditPage({
  params,
}: {
  params: Promise<{ scenario: string }>;
}) {
  await requireAdminUser();
  const tenant = await requireTenant();
  const { scenario } = await params;

  const meta = SCENARIOS.find((s) => s.key === scenario);
  if (!meta) notFound();

  const supabase = createSupabaseAdminClient();
  const { data: custom } = await supabase
    .from('email_templates')
    .select('subject, body_json')
    .eq('org_id', tenant.id)
    .eq('scenario', scenario)
    .maybeSingle();

  const initialSubject = (custom?.subject as string) ?? meta.defaultSubject;
  const initialBodyJson = (custom?.body_json as Record<string, unknown>) ?? meta.defaultBodyJson;

  return (
    <EmailTemplateEditor
      scenario={scenario as ScenarioKey}
      label={meta.label}
      variables={meta.variables}
      initialSubject={initialSubject}
      initialBodyJson={initialBodyJson}
    />
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add 'src/app/(admin)/admin/email-templates/[scenario]/page.tsx'
git commit -m "feat(admin): 이메일 템플릿 에디터 페이지 — Server Component wrapper"
```

---

### Task 13: 사이드바 메뉴 추가

**Files:**
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: 설정 그룹에 메뉴 추가**

`src/components/admin/sidebar.tsx`의 `NAV` 배열 중 `group: "설정"` 섹션의 `items` 배열에 추가:

```typescript
      { label: "이메일 템플릿", href: "/admin/email-templates" },
```

"감사 로그" 항목 뒤에 삽입한다.

- [ ] **Step 2: 빌드 확인**

```bash
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/components/admin/sidebar.tsx
git commit -m "feat(admin): 사이드바에 이메일 템플릿 메뉴 추가"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 태스크 |
|------|------|
| email_templates 테이블 + RLS | Task 1 |
| 시나리오별 기본 템플릿 | Task 2 |
| Tiptap JSON → 이메일 HTML 렌더러 | Task 3 |
| 변수 치환 | Task 3 (substituteVariables) |
| 기관 테마 래핑 | Task 3 (wrapWithTheme) |
| DB 조회 → 폴백 리졸버 | Task 4 |
| email.ts 리팩토링 (orgId + resolveTemplate) | Task 5 |
| 호출부 orgId 전달 | Task 6 |
| CRUD API | Task 7 |
| 미리보기 API | Task 8 |
| 테스트 발송 API | Task 8 |
| Tiptap 패키지 | Task 9 |
| WYSIWYG 에디터 + 변수 드롭다운 + 미리보기 | Task 10 |
| 템플릿 목록 카드 페이지 | Task 11 |
| 에디터 페이지 wrapper | Task 12 |
| 사이드바 메뉴 | Task 13 |
| 엣지 케이스: 빈 body_json | Task 7 (validation) |
| 엣지 케이스: 없는 시나리오 | Task 7 (validation) |
| 엣지 케이스: theme_config null | Task 3 (기본값 처리) |
| 엣지 케이스: unknown node type | Task 3 (graceful skip) |

### Type Consistency Check

- `ScenarioKey` — Task 2에서 정의, Task 4/5/7/8/10/12에서 import
- `renderTemplate(bodyJson, variables, theme)` — Task 3에서 정의, Task 4/7/8에서 동일 시그니처
- `renderSubject(subjectTemplate, variables)` — Task 3에서 정의, Task 7/8에서 동일
- `resolveTemplate(orgId, scenario, variables)` — Task 4에서 정의, Task 5에서 호출
- `DonationConfirmedParams.orgId` — Task 5에서 추가, Task 6에서 전달
- `getSampleVariables(scenario)` — Task 2에서 정의, Task 8에서 사용
