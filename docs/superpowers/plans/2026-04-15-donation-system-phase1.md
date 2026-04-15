# NPO 후원관리시스템 Phase 1 구현 계획서

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SaaS 기반 NPO 후원관리시스템 Phase 1을 구축한다. 각 비영리단체가 독립 테넌트로 구독·운영하며, 단체 랜딩페이지·캠페인·후원·결제·영수증 기능을 제공한다.

**Architecture:** Next.js 15 App Router 단일 앱 + Supabase 단일 DB에서 `org_id` 기반 RLS로 멀티테넌트 격리. 서브도메인(`{slug}.supporters.kr`)에서 middleware가 테넌트를 식별해 컨텍스트를 주입한다. Toss Payments SDK로 PG·CMS 결제를 통합 처리하고, `pdfmake`로 기부금 영수증을 자체 생성한다.

**Tech Stack:** Next.js 15 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · Supabase · Toss Payments · pdfmake · isomorphic-dompurify · Vitest · Playwright

**Spec Reference:** `docs/superpowers/specs/2026-04-15-donation-system-design.md`

---

## Phase 구성

| Phase | 범위 | 산출물 |
|-------|------|--------|
| Phase 1.A | 프로젝트 스캐폴딩 + 디자인 시스템 | Next.js 앱, 5색 토큰, shadcn/ui |
| Phase 1.B | 멀티테넌트 인프라 | orgs 테이블, middleware, RLS, 테넌트 컨텍스트 |
| Phase 1.C | 인증 + 관리자 쉘 | Supabase Auth, GNB, 관리자 레이아웃 |
| Phase 1.D | 단체 랜딩페이지 + 캠페인 | (landing), (public)/c/[slug], 캠페인 CRUD |
| Phase 1.E | 결제 통합 + 후원 플로우 | Toss PG/CMS, promises, payments, 웹훅 |
| Phase 1.F | 후원자 관리 + 마이페이지 | 후원자 CRUD, (donor)/my |
| Phase 1.G | 영수증 + 대시보드 | PDF 영수증, 대시보드 KPI, 미납 관리 |

---

## 파일 구조

```
src/
├── app/
│   ├── layout.tsx                      # 루트 레이아웃, 테마 주입
│   ├── globals.css                     # 5색 토큰 정의
│   ├── (landing)/                      # 단체 대표 랜딩페이지
│   ├── (public)/                       # 캠페인 공개 페이지
│   ├── (donor)/                        # 후원자 마이페이지
│   ├── (admin)/                        # 관리자 백오피스
│   ├── auth/                           # 로그인/콜백
│   └── api/                            # API 라우트
├── components/
│   ├── ui/                             # shadcn/ui
│   ├── gnb/                            # 사이드바 네비
│   ├── landing/                        # 랜딩 섹션
│   ├── campaign/                       # 캠페인 카드/폼
│   ├── dashboard/                      # KPI 위젯
│   ├── donors/                         # 후원자 테이블/탭
│   └── payments/                       # 납입 테이블
├── lib/
│   ├── supabase/                       # server/client/admin
│   ├── tenant/                         # 테넌트 리졸버/컨텍스트
│   ├── auth/                           # 가드 헬퍼
│   ├── toss/                           # Toss 클라이언트/웹훅
│   ├── pdf/                            # PDF 생성
│   ├── sanitize.ts                     # HTML 살균
│   ├── codes.ts                        # 코드 생성
│   └── utils.ts
├── middleware.ts                       # 테넌트 식별
└── types/

supabase/migrations/                    # SQL 마이그레이션
tests/unit/                             # Vitest 단위 테스트
tests/e2e/                              # Playwright E2E
```

---

# Phase 1.A — 프로젝트 스캐폴딩 + 디자인 시스템

## Task A1: Next.js 15 프로젝트 초기화

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.local.example`

- [ ] **Step 1: Next.js 앱 생성**

Run:
```bash
cd /Users/gloryinside/NPO_S
npx create-next-app@latest . --typescript --tailwind --app --src-dir --import-alias "@/*" --no-eslint --turbopack
```

- [ ] **Step 2: 필수 의존성 설치**

Run:
```bash
npm install @supabase/supabase-js @supabase/ssr pdfmake @tosspayments/payment-sdk isomorphic-dompurify zod lucide-react
npm install -D @types/node @types/pdfmake vitest @vitejs/plugin-react @playwright/test
```

- [ ] **Step 3: `.env.local.example` 작성**

Create `.env.local.example`:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_TOSS_CLIENT_KEY=
TOSS_SECRET_KEY=
TOSS_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_BASE_DOMAIN=supporters.kr
```

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "chore: Next.js 15 프로젝트 초기화 + 의존성 설치"
```

## Task A2: 5색 의미 색상 토큰 정의

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`

- [ ] **Step 1: globals.css에 디자인 토큰 주입**

Replace `src/app/globals.css`:
```css
@import "tailwindcss";

:root {
  --bg:        #0a0a0f;
  --surface:   #13131a;
  --surface-2: #1c1c27;
  --border:    #2a2a3a;
  --text:      #f0f0f8;
  --muted:     #8888aa;
  --muted-2:   #55556a;

  --accent:    #7c3aed;
  --positive:  #22c55e;
  --negative:  #ef4444;
  --warning:   #f59e0b;
  --info:      #38bdf8;

  --accent-soft:   rgba(124, 58, 237, 0.12);
  --positive-soft: rgba(34, 197, 94, 0.12);
  --negative-soft: rgba(239, 68, 68, 0.12);
  --warning-soft:  rgba(245, 158, 11, 0.12);
  --info-soft:     rgba(56, 189, 248, 0.12);
}

@theme inline {
  --color-bg: var(--bg);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-border: var(--border);
  --color-text: var(--text);
  --color-muted: var(--muted);
  --color-muted-2: var(--muted-2);
  --color-accent: var(--accent);
  --color-positive: var(--positive);
  --color-negative: var(--negative);
  --color-warning: var(--warning);
  --color-info: var(--info);
}

html, body {
  background: var(--bg);
  color: var(--text);
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

- [ ] **Step 2: 루트 레이아웃**

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Supporters — NPO 후원관리 플랫폼",
  description: "비영리단체를 위한 후원관리 SaaS",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css src/app/layout.tsx
git commit -m "feat(design): 5색 의미 토큰 시스템 + 다크 테마 적용"
```

## Task A3: shadcn/ui 초기화

**Files:**
- Create: `components.json`, `src/components/ui/*`

- [ ] **Step 1: shadcn/ui 초기화**

Run:
```bash
npx shadcn@latest init -d
npx shadcn@latest add button card badge input label select dialog tabs table toast
```

- [ ] **Step 2: Commit**

```bash
git add .
git commit -m "feat(ui): shadcn/ui 초기화 + 기본 컴포넌트 설치"
```

---

# Phase 1.B — 멀티테넌트 인프라

## Task B1: Supabase 클라이언트 헬퍼

**Files:**
- Create: `src/lib/supabase/server.ts`, `client.ts`, `admin.ts`

- [ ] **Step 1: 서버 클라이언트**

Create `src/lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
```

- [ ] **Step 2: 브라우저 클라이언트**

Create `src/lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: service-role 클라이언트**

Create `src/lib/supabase/admin.ts`:
```ts
import { createClient } from "@supabase/supabase-js";

export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/
git commit -m "feat(supabase): 서버/브라우저/어드민 클라이언트 헬퍼"
```

## Task B2: orgs 테이블 마이그레이션

**Files:**
- Create: `supabase/migrations/20260415000001_orgs.sql`, `supabase/seed.sql`

- [ ] **Step 1: orgs 마이그레이션 SQL**

Create `supabase/migrations/20260415000001_orgs.sql`:
```sql
CREATE TABLE orgs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            text UNIQUE NOT NULL,
  name            text NOT NULL,
  business_no     text,
  logo_url        text,
  hero_image_url  text,
  tagline         text,
  about           text,
  contact_email   text,
  contact_phone   text,
  address         text,
  show_stats      boolean NOT NULL DEFAULT true,
  custom_domain   text UNIQUE,
  plan            text NOT NULL DEFAULT 'basic',
  status          text NOT NULL DEFAULT 'active',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_orgs_slug ON orgs(slug);
CREATE INDEX idx_orgs_custom_domain ON orgs(custom_domain) WHERE custom_domain IS NOT NULL;

ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "orgs_public_read" ON orgs FOR SELECT USING (status = 'active');
```

- [ ] **Step 2: 시드 데이터**

Create `supabase/seed.sql`:
```sql
INSERT INTO orgs (slug, name, tagline, about, contact_email)
VALUES
  ('demo', '데모 복지재단', '함께하는 나눔, 변화의 시작', '데모 복지재단은 소외된 이웃을 돕는 비영리단체입니다.', 'contact@demo.example'),
  ('hope', '희망 어린이재단', '아이들의 꿈을 지켜주세요', '희망 어린이재단은 아동 복지를 위해 설립되었습니다.', 'info@hope.example');
```

- [ ] **Step 3: 마이그레이션 적용**

Run: `npx supabase db push`

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat(db): orgs 테이블 마이그레이션 + 시드 데이터"
```

## Task B3: 테넌트 리졸버

**Files:**
- Create: `src/lib/tenant/types.ts`, `resolver.ts`, `tests/unit/tenant-resolver.test.ts`, `vitest.config.ts`

- [ ] **Step 1: 타입**

Create `src/lib/tenant/types.ts`:
```ts
export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: "active" | "suspended" | "trial";
};
```

- [ ] **Step 2: vitest 설정**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: { environment: "node", globals: true },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
```

- [ ] **Step 3: 실패 테스트**

Create `tests/unit/tenant-resolver.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { extractSlugFromHost } from "@/lib/tenant/resolver";

describe("extractSlugFromHost", () => {
  it("서브도메인에서 slug를 추출한다", () => {
    expect(extractSlugFromHost("demo.supporters.kr")).toBe("demo");
    expect(extractSlugFromHost("hope.supporters.kr")).toBe("hope");
  });

  it("루트 도메인은 null을 반환한다", () => {
    expect(extractSlugFromHost("supporters.kr")).toBeNull();
    expect(extractSlugFromHost("www.supporters.kr")).toBeNull();
  });

  it("localhost 서브도메인을 지원한다", () => {
    expect(extractSlugFromHost("localhost:3000")).toBeNull();
    expect(extractSlugFromHost("demo.localhost:3000")).toBe("demo");
  });
});
```

Run: `npx vitest run tests/unit/tenant-resolver.test.ts`
Expected: FAIL

- [ ] **Step 4: resolver 구현**

Create `src/lib/tenant/resolver.ts`:
```ts
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "./types";

const RESERVED = new Set(["www", "platform", "api", "admin"]);

export function extractSlugFromHost(host: string): string | null {
  const hostname = host.split(":")[0];
  const parts = hostname.split(".");

  if (hostname.endsWith("localhost")) {
    return parts.length >= 2 ? parts[0] : null;
  }

  if (parts.length < 3) return null;
  const slug = parts[0];
  if (RESERVED.has(slug)) return null;
  return slug;
}

export async function resolveTenant(host: string): Promise<Tenant | null> {
  const slug = extractSlugFromHost(host);
  if (!slug) return null;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("id, slug, name, status")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  return data as Tenant | null;
}
```

- [ ] **Step 5: 테스트 통과**

Run: `npx vitest run tests/unit/tenant-resolver.test.ts`
Expected: 3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/tenant/ tests/unit/tenant-resolver.test.ts vitest.config.ts
git commit -m "feat(tenant): 호스트 기반 테넌트 리졸버 + 단위 테스트"
```

## Task B4: middleware + 테넌트 컨텍스트

**Files:**
- Create: `src/middleware.ts`, `src/lib/tenant/context.ts`, `src/app/page.tsx`

- [ ] **Step 1: middleware**

Create `src/middleware.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolver";

export async function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const tenant = await resolveTenant(host);

  const res = NextResponse.next();
  if (tenant) {
    res.headers.set("x-tenant-id", tenant.id);
    res.headers.set("x-tenant-slug", tenant.slug);
  }
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)"],
};
```

- [ ] **Step 2: 컨텍스트 헬퍼**

Create `src/lib/tenant/context.ts`:
```ts
import { headers } from "next/headers";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tenant } from "./types";

export async function getTenant(): Promise<Tenant | null> {
  const h = await headers();
  const id = h.get("x-tenant-id");
  if (!id) return null;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("id, slug, name, status")
    .eq("id", id)
    .maybeSingle();

  return data as Tenant | null;
}

export async function requireTenant(): Promise<Tenant> {
  const tenant = await getTenant();
  if (!tenant) throw new Error("Tenant not found");
  return tenant;
}
```

- [ ] **Step 3: 루트 확인 페이지**

Create `src/app/page.tsx`:
```tsx
import { getTenant } from "@/lib/tenant/context";

export default async function HomePage() {
  const tenant = await getTenant();
  if (!tenant) {
    return (
      <main className="p-8">
        <h1 className="text-2xl font-bold">Supporters 플랫폼</h1>
        <p className="text-[var(--muted)]">
          서브도메인으로 접근하세요: <code>demo.localhost:3000</code>
        </p>
      </main>
    );
  }
  return (
    <main className="p-8">
      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      <p className="text-[var(--muted)]">slug: {tenant.slug}</p>
    </main>
  );
}
```

- [ ] **Step 4: 동작 확인**

Run: `npm run dev`
접속: `http://demo.localhost:3000`
Expected: "데모 복지재단" 표시

- [ ] **Step 5: Commit**

```bash
git add src/middleware.ts src/lib/tenant/context.ts src/app/page.tsx
git commit -m "feat(tenant): middleware 테넌트 헤더 주입 + 컨텍스트 헬퍼"
```

## Task B5: 핵심 테이블 마이그레이션

**Files:**
- Create: `supabase/migrations/20260415000002_campaigns.sql` ~ `20260415000006_receipts.sql`

- [ ] **Step 1: campaigns**

Create `supabase/migrations/20260415000002_campaigns.sql`:
```sql
CREATE TABLE campaigns (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  slug            text NOT NULL,
  title           text NOT NULL,
  description     text,
  thumbnail_url   text,
  donation_type   text NOT NULL CHECK (donation_type IN ('regular','onetime','both')),
  goal_amount     bigint,
  started_at      timestamptz,
  ended_at        timestamptz,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  pg_config       jsonb,
  preset_amounts  jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, slug)
);

CREATE INDEX idx_campaigns_org ON campaigns(org_id);
CREATE INDEX idx_campaigns_status ON campaigns(org_id, status);
```

- [ ] **Step 2: members**

Create `supabase/migrations/20260415000003_members.sql`:
```sql
CREATE TABLE members (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  member_code     text NOT NULL,
  supabase_uid    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name            text NOT NULL,
  phone           text,
  email           text,
  birth_date      date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','deceased')),
  member_type     text NOT NULL DEFAULT 'individual' CHECK (member_type IN ('individual','corporate')),
  join_path       text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, member_code)
);

CREATE INDEX idx_members_org ON members(org_id);
CREATE INDEX idx_members_name ON members(org_id, name);
CREATE INDEX idx_members_phone ON members(org_id, phone);
CREATE INDEX idx_members_email ON members(org_id, email);
CREATE INDEX idx_members_supabase_uid ON members(supabase_uid) WHERE supabase_uid IS NOT NULL;
```

- [ ] **Step 3: promises**

Create `supabase/migrations/20260415000004_promises.sql`:
```sql
CREATE TABLE promises (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  promise_code      text NOT NULL,
  member_id         uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  campaign_id       uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  type              text NOT NULL CHECK (type IN ('regular','onetime')),
  amount            bigint NOT NULL,
  pay_day           integer CHECK (pay_day BETWEEN 1 AND 28),
  pay_method        text NOT NULL,
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled','completed')),
  toss_billing_key  text,
  started_at        date NOT NULL,
  ended_at          date,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, promise_code)
);

CREATE INDEX idx_promises_org ON promises(org_id);
CREATE INDEX idx_promises_member ON promises(member_id);
CREATE INDEX idx_promises_campaign ON promises(campaign_id);
CREATE INDEX idx_promises_status ON promises(org_id, status);
```

- [ ] **Step 4: payments**

Create `supabase/migrations/20260415000005_payments.sql`:
```sql
CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  payment_code    text NOT NULL,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  promise_id      uuid REFERENCES promises(id) ON DELETE SET NULL,
  campaign_id     uuid NOT NULL REFERENCES campaigns(id) ON DELETE RESTRICT,
  amount          bigint NOT NULL,
  pay_date        date NOT NULL,
  deposit_date    timestamptz,
  pay_status      text NOT NULL DEFAULT 'unpaid' CHECK (pay_status IN ('paid','unpaid','failed','cancelled','refunded','pending')),
  income_status   text NOT NULL DEFAULT 'pending' CHECK (income_status IN ('pending','confirmed','excluded')),
  pg_tx_id        text,
  pg_method       text,
  fail_reason     text,
  receipt_id      uuid,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, payment_code)
);

CREATE INDEX idx_payments_org ON payments(org_id);
CREATE INDEX idx_payments_member ON payments(member_id);
CREATE INDEX idx_payments_promise ON payments(promise_id);
CREATE INDEX idx_payments_pay_date ON payments(org_id, pay_date);
CREATE INDEX idx_payments_status ON payments(org_id, pay_status);
```

- [ ] **Step 5: receipts + FK**

Create `supabase/migrations/20260415000006_receipts.sql`:
```sql
CREATE TABLE receipts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  receipt_code    text NOT NULL,
  member_id       uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  year            integer NOT NULL,
  total_amount    bigint NOT NULL,
  pdf_url         text,
  issued_at       timestamptz,
  issued_by       uuid REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, receipt_code)
);

CREATE INDEX idx_receipts_org ON receipts(org_id);
CREATE INDEX idx_receipts_member ON receipts(member_id, year);

ALTER TABLE payments
  ADD CONSTRAINT fk_payments_receipt
  FOREIGN KEY (receipt_id) REFERENCES receipts(id) ON DELETE SET NULL;
```

- [ ] **Step 6: 적용**

Run: `npx supabase db push`

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): 핵심 테이블 5개 마이그레이션"
```

## Task B6: RLS 정책

**Files:**
- Create: `supabase/migrations/20260415000007_rls_policies.sql`

- [ ] **Step 1: RLS SQL**

Create `supabase/migrations/20260415000007_rls_policies.sql`:
```sql
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE promises ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_org_admin(target_org uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (raw_user_meta_data->>'role') = 'admin'
      AND (raw_user_meta_data->>'org_id')::uuid = target_org
  );
$$ LANGUAGE sql STABLE;

CREATE POLICY "campaigns_public_read" ON campaigns
  FOR SELECT USING (status = 'active');
CREATE POLICY "campaigns_admin_all" ON campaigns
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

CREATE POLICY "members_self_read" ON members
  FOR SELECT USING (supabase_uid = auth.uid());
CREATE POLICY "members_admin_all" ON members
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

CREATE POLICY "promises_self_read" ON promises
  FOR SELECT USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));
CREATE POLICY "promises_admin_all" ON promises
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

CREATE POLICY "payments_self_read" ON payments
  FOR SELECT USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));
CREATE POLICY "payments_admin_all" ON payments
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));

CREATE POLICY "receipts_self_read" ON receipts
  FOR SELECT USING (member_id IN (SELECT id FROM members WHERE supabase_uid = auth.uid()));
CREATE POLICY "receipts_admin_all" ON receipts
  FOR ALL USING (is_org_admin(org_id)) WITH CHECK (is_org_admin(org_id));
```

- [ ] **Step 2: 적용**

Run: `npx supabase db push`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260415000007_rls_policies.sql
git commit -m "feat(db): RLS 정책 — 테넌트 격리 + 역할별 권한"
```

## Task B7: 코드 생성 유틸

**Files:**
- Create: `src/lib/codes.ts`, `tests/unit/codes.test.ts`

- [ ] **Step 1: 실패 테스트**

Create `tests/unit/codes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { generateMemberCode, generatePromiseCode, generatePaymentCode, generateReceiptCode } from "@/lib/codes";

describe("code generators", () => {
  it("후원자 코드", () => {
    expect(generateMemberCode(2026, 1)).toBe("M-202600001");
  });
  it("약정 코드", () => {
    expect(generatePromiseCode(2026, 42)).toBe("P-202600042");
  });
  it("납입 코드", () => {
    expect(generatePaymentCode(2026, 100)).toBe("PMT-202600100");
  });
  it("영수증 코드", () => {
    expect(generateReceiptCode(2026, 5)).toBe("RCP-2026-00005");
  });
});
```

Run: `npx vitest run tests/unit/codes.test.ts`
Expected: FAIL

- [ ] **Step 2: 구현**

Create `src/lib/codes.ts`:
```ts
const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function generateMemberCode(year: number, seq: number): string {
  return `M-${year}${pad(seq, 5)}`;
}
export function generatePromiseCode(year: number, seq: number): string {
  return `P-${year}${pad(seq, 5)}`;
}
export function generatePaymentCode(year: number, seq: number): string {
  return `PMT-${year}${pad(seq, 5)}`;
}
export function generateReceiptCode(year: number, seq: number): string {
  return `RCP-${year}-${pad(seq, 5)}`;
}
```

Run: `npx vitest run tests/unit/codes.test.ts`
Expected: 4 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/codes.ts tests/unit/codes.test.ts
git commit -m "feat(codes): 코드 생성 유틸 + 단위 테스트"
```

## Task B8: HTML 살균 유틸

**Files:**
- Create: `src/lib/sanitize.ts`, `tests/unit/sanitize.test.ts`

- [ ] **Step 1: 실패 테스트**

Create `tests/unit/sanitize.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/sanitize";

describe("sanitizeHtml", () => {
  it("script 태그를 제거한다", () => {
    const dirty = "<p>안녕</p><script>alert(1)</script>";
    expect(sanitizeHtml(dirty)).not.toContain("<script>");
    expect(sanitizeHtml(dirty)).toContain("<p>안녕</p>");
  });

  it("onclick 이벤트 핸들러를 제거한다", () => {
    const dirty = '<a href="/" onclick="steal()">링크</a>';
    expect(sanitizeHtml(dirty)).not.toContain("onclick");
  });

  it("허용된 태그는 보존한다", () => {
    const clean = "<p><strong>굵게</strong> <em>기울임</em></p>";
    const result = sanitizeHtml(clean);
    expect(result).toContain("<strong>");
    expect(result).toContain("<em>");
  });
});
```

Run: `npx vitest run tests/unit/sanitize.test.ts`
Expected: FAIL

- [ ] **Step 2: 구현**

Create `src/lib/sanitize.ts`:
```ts
import DOMPurify from "isomorphic-dompurify";

const ALLOWED_TAGS = [
  "p", "br", "strong", "em", "u", "s", "h1", "h2", "h3", "h4",
  "ul", "ol", "li", "blockquote", "a", "img", "hr",
];

const ALLOWED_ATTR = ["href", "target", "rel", "src", "alt", "title"];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_ATTR: ["style", "onerror", "onload", "onclick"],
  });
}
```

Run: `npx vitest run tests/unit/sanitize.test.ts`
Expected: 3 tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/sanitize.ts tests/unit/sanitize.test.ts
git commit -m "feat(security): DOMPurify 기반 HTML 살균 유틸"
```

---

# Phase 1.C — 인증 + 관리자 쉘

## Task C1: 로그인 페이지 + Auth callback

**Files:**
- Create: `src/app/auth/login/page.tsx`, `src/app/auth/callback/route.ts`

- [ ] **Step 1: 로그인 페이지**

Create `src/app/auth/login/page.tsx`:
```tsx
"use client";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError(error.message); return; }
    window.location.href = "/admin";
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <h1 className="text-2xl font-bold">로그인</h1>
        <div>
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p className="text-sm text-[var(--negative)]">{error}</p>}
        <Button type="submit" className="w-full">로그인</Button>
      </form>
    </main>
  );
}
```

- [ ] **Step 2: Auth callback**

Create `src/app/auth/callback/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/admin";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/auth/
git commit -m "feat(auth): 로그인 페이지 + OAuth callback"
```

## Task C2: 관리자 가드 + 레이아웃

**Files:**
- Create: `src/lib/auth/require-admin.ts`, `src/app/(admin)/layout.tsx`

- [ ] **Step 1: 관리자 가드**

Create `src/lib/auth/require-admin.ts`:
```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/context";

export async function requireAdmin() {
  const tenant = await requireTenant();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const role = user.user_metadata?.role;
  const userOrgId = user.user_metadata?.org_id;

  if (role !== "admin" || userOrgId !== tenant.id) {
    redirect("/auth/login?error=unauthorized");
  }

  return { user, tenant };
}
```

- [ ] **Step 2: 관리자 레이아웃**

Create `src/app/(admin)/layout.tsx`:
```tsx
import { requireAdmin } from "@/lib/auth/require-admin";
import { Sidebar } from "@/components/gnb/sidebar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { tenant } = await requireAdmin();
  return (
    <div className="flex min-h-screen bg-[var(--bg)]">
      <Sidebar tenantName={tenant.name} />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth/require-admin.ts "src/app/(admin)/layout.tsx"
git commit -m "feat(auth): 관리자 가드 + 관리자 레이아웃"
```

## Task C3: GNB 사이드바

**Files:**
- Create: `src/components/gnb/nav-config.ts`, `nav-item.tsx`, `nav-group.tsx`, `sidebar.tsx`

- [ ] **Step 1: nav-config**

Create `src/components/gnb/nav-config.ts`:
```ts
import { LayoutDashboard, Users, CreditCard, Megaphone, FileText, Cog, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  badge?: { count: number; tone: "negative" | "warning" };
};

export type NavGroup = {
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
  defaultOpen?: boolean;
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    label: "개요",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [{ label: "대시보드", href: "/admin" }],
  },
  {
    key: "donors",
    label: "후원자 관리",
    icon: Users,
    defaultOpen: true,
    items: [
      { label: "후원자 목록", href: "/admin/donors" },
      { label: "후원자 등록", href: "/admin/donors/new" },
    ],
  },
  {
    key: "payments",
    label: "결제 관리",
    icon: CreditCard,
    defaultOpen: true,
    items: [
      { label: "납부현황", href: "/admin/payments" },
      { label: "미납 관리", href: "/admin/unpaid" },
      { label: "정기 스케줄", href: "/admin/schedules" },
      { label: "출금 오류", href: "/admin/cms-errors" },
    ],
  },
  {
    key: "campaigns",
    label: "캠페인",
    icon: Megaphone,
    defaultOpen: true,
    items: [
      { label: "캠페인 목록", href: "/admin/campaigns" },
      { label: "캠페인 등록", href: "/admin/campaigns/new" },
    ],
  },
  {
    key: "receipts",
    label: "재무·영수증",
    icon: FileText,
    defaultOpen: false,
    items: [
      { label: "기부금 영수증 발행", href: "/admin/receipts/issue" },
      { label: "영수증 이력", href: "/admin/receipts" },
    ],
  },
  {
    key: "settings",
    label: "시스템 설정",
    icon: Cog,
    defaultOpen: false,
    items: [
      { label: "단체 정보", href: "/admin/settings/org" },
      { label: "관리자 계정", href: "/admin/settings/users" },
    ],
  },
];
```

- [ ] **Step 2: NavItem**

Create `src/components/gnb/nav-item.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem as NavItemType } from "./nav-config";

export function NavItem({ item }: { item: NavItemType }) {
  const pathname = usePathname();
  const active = pathname === item.href;

  return (
    <Link
      href={item.href}
      className="flex items-center justify-between pl-[52px] pr-4 h-9 text-sm hover:bg-[var(--surface-2)] rounded-md"
      style={{
        backgroundColor: active ? "var(--accent-soft)" : undefined,
        color: active ? "var(--accent)" : "var(--text)",
        fontWeight: active ? 600 : 400,
      }}
    >
      <span>{item.label}</span>
      {item.badge && (
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: `var(--${item.badge.tone}-soft)`,
            color: `var(--${item.badge.tone})`,
          }}
        >
          {item.badge.count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 3: NavGroup**

Create `src/components/gnb/nav-group.tsx`:
```tsx
"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { NavGroup as NavGroupType } from "./nav-config";
import { NavItem } from "./nav-item";

export function NavGroup({ group }: { group: NavGroupType }) {
  const [open, setOpen] = useState(group.defaultOpen ?? true);
  const Icon = group.icon;

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center h-10 hover:bg-[var(--surface-2)] rounded-md"
      >
        <div className="w-[52px] flex items-center justify-center">
          <Icon size={18} color="var(--muted-2)" strokeWidth={1.5} />
        </div>
        <span className="flex-1 text-left text-sm font-medium">{group.label}</span>
        <ChevronRight
          size={14}
          className="mr-3 transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none", color: "var(--muted-2)" }}
        />
      </button>
      {open && (
        <div className="space-y-0.5 py-1">
          {group.items.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Sidebar**

Create `src/components/gnb/sidebar.tsx`:
```tsx
import { NAV_GROUPS } from "./nav-config";
import { NavGroup } from "./nav-group";

export function Sidebar({ tenantName }: { tenantName: string }) {
  return (
    <aside className="w-[240px] shrink-0 border-r border-[var(--border)] bg-[var(--surface)] flex flex-col">
      <div className="h-14 px-4 flex items-center border-b border-[var(--border)]">
        <span className="font-semibold truncate">{tenantName}</span>
      </div>
      <nav className="flex-1 overflow-auto py-2 px-2 space-y-1">
        {NAV_GROUPS.map((group) => (
          <NavGroup key={group.key} group={group} />
        ))}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/gnb/
git commit -m "feat(gnb): 확장/축소형 사이드바 (그룹 아이콘 + 서브 텍스트)"
```

---

# Phase 1.D — 단체 랜딩페이지 + 캠페인

## Task D1: 랜딩 레이아웃 + 페이지

**Files:**
- Delete: `src/app/page.tsx`
- Create: `src/app/(landing)/layout.tsx`, `src/app/(landing)/page.tsx`

- [ ] **Step 1: 기존 루트 page 제거**

Run: `rm src/app/page.tsx`

- [ ] **Step 2: 랜딩 레이아웃**

Create `src/app/(landing)/layout.tsx`:
```tsx
import { requireTenant } from "@/lib/tenant/context";

export default async function LandingLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="h-16 border-b border-[var(--border)] flex items-center px-8">
        <span className="font-bold text-lg">{tenant.name}</span>
      </header>
      {children}
      <footer className="border-t border-[var(--border)] mt-20 py-8 px-8 text-sm text-[var(--muted)]">
        <p>© 2026 {tenant.name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 3: 랜딩 페이지**

Create `src/app/(landing)/page.tsx`:
```tsx
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { HeroSection } from "@/components/landing/hero-section";
import { AboutSection } from "@/components/landing/about-section";
import { CampaignsGrid } from "@/components/landing/campaigns-grid";
import { StatsSection } from "@/components/landing/stats-section";

export default async function LandingPage() {
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: org } = await supabase.from("orgs").select("*").eq("id", tenant.id).single();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, slug, title, description, thumbnail_url, goal_amount, donation_type")
    .eq("org_id", tenant.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  return (
    <>
      <HeroSection org={org} />
      <AboutSection about={org.about} />
      <CampaignsGrid campaigns={campaigns ?? []} />
      {org.show_stats && <StatsSection orgId={tenant.id} />}
    </>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/
git commit -m "feat(landing): 단체 랜딩페이지 레이아웃 + 데이터 로딩"
```

## Task D2: 랜딩 섹션 컴포넌트

**Files:**
- Create: `src/components/landing/hero-section.tsx`, `about-section.tsx`, `campaigns-grid.tsx`, `stats-section.tsx`
- Create: `src/components/campaign/progress-bar.tsx`, `campaign-card.tsx`

- [ ] **Step 1: HeroSection**

Create `src/components/landing/hero-section.tsx`:
```tsx
import { Button } from "@/components/ui/button";

type Org = {
  name: string;
  tagline: string | null;
  hero_image_url: string | null;
};

export function HeroSection({ org }: { org: Org }) {
  return (
    <section className="relative h-[480px] flex items-center justify-center">
      {org.hero_image_url && (
        <div
          className="absolute inset-0 bg-cover bg-center opacity-40"
          style={{ backgroundImage: `url(${org.hero_image_url})` }}
        />
      )}
      <div className="relative text-center max-w-2xl px-6">
        <h1 className="text-5xl font-bold mb-4">{org.name}</h1>
        {org.tagline && <p className="text-xl text-[var(--muted)] mb-8">{org.tagline}</p>}
        <Button size="lg" asChild>
          <a href="#campaigns">지금 후원하기</a>
        </Button>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: AboutSection (DOMPurify 적용)**

Create `src/components/landing/about-section.tsx`:
```tsx
import { sanitizeHtml } from "@/lib/sanitize";

export function AboutSection({ about }: { about: string | null }) {
  if (!about) return null;
  const safe = sanitizeHtml(about);
  return (
    <section className="max-w-3xl mx-auto px-8 py-16">
      <h2 className="text-2xl font-bold mb-6">우리의 이야기</h2>
      <div
        className="prose prose-invert max-w-none text-[var(--text)]"
        // 관리자가 저장한 HTML은 sanitizeHtml()로 살균 후 렌더링한다.
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </section>
  );
}
```

- [ ] **Step 3: ProgressBar**

Create `src/components/campaign/progress-bar.tsx`:
```tsx
export function ProgressBar({ current, goal }: { current: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, (current / goal) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 bg-[var(--surface-2)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[var(--accent)] rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-[var(--muted)]">
        <span>{current.toLocaleString()}원</span>
        <span>{pct.toFixed(0)}%</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: CampaignCard**

Create `src/components/campaign/campaign-card.tsx`:
```tsx
import Link from "next/link";
import { ProgressBar } from "./progress-bar";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  goal_amount: number | null;
};

export function CampaignCard({ campaign, currentAmount = 0 }: { campaign: Campaign; currentAmount?: number }) {
  return (
    <Link
      href={`/c/${campaign.slug}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden hover:border-[var(--accent)] transition-colors"
    >
      {campaign.thumbnail_url && (
        <div
          className="h-40 bg-cover bg-center"
          style={{ backgroundImage: `url(${campaign.thumbnail_url})` }}
        />
      )}
      <div className="p-5 space-y-3">
        <h3 className="font-semibold text-lg line-clamp-2">{campaign.title}</h3>
        {campaign.description && (
          <p className="text-sm text-[var(--muted)] line-clamp-2">{campaign.description}</p>
        )}
        {campaign.goal_amount && <ProgressBar current={currentAmount} goal={campaign.goal_amount} />}
      </div>
    </Link>
  );
}
```

- [ ] **Step 5: CampaignsGrid**

Create `src/components/landing/campaigns-grid.tsx`:
```tsx
import { CampaignCard } from "@/components/campaign/campaign-card";

type Campaign = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  goal_amount: number | null;
  donation_type: string;
};

export function CampaignsGrid({ campaigns }: { campaigns: Campaign[] }) {
  return (
    <section id="campaigns" className="max-w-6xl mx-auto px-8 py-16">
      <h2 className="text-2xl font-bold mb-8">진행 중인 캠페인</h2>
      {campaigns.length === 0 ? (
        <p className="text-[var(--muted)]">현재 진행 중인 캠페인이 없습니다.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: StatsSection**

Create `src/components/landing/stats-section.tsx`:
```tsx
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function StatsSection({ orgId }: { orgId: string }) {
  const supabase = createSupabaseAdminClient();

  const { count: donorCount } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "active");

  const { data: totalData } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", orgId)
    .eq("pay_status", "paid");

  const totalAmount = (totalData ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <section className="max-w-4xl mx-auto px-8 py-16">
      <div className="grid grid-cols-2 gap-8">
        <div className="text-center p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="text-4xl font-bold text-[var(--accent)]">{donorCount ?? 0}</div>
          <div className="text-sm text-[var(--muted)] mt-2">누적 후원자</div>
        </div>
        <div className="text-center p-8 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
          <div className="text-4xl font-bold text-[var(--accent)]">
            {totalAmount.toLocaleString()}원
          </div>
          <div className="text-sm text-[var(--muted)] mt-2">누적 후원금</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add src/components/landing/ src/components/campaign/
git commit -m "feat(landing): 히어로/소개/캠페인그리드/통계 섹션 + DOMPurify 살균"
```

## Task D3: 캠페인 공개 페이지

**Files:**
- Create: `src/app/(public)/layout.tsx`, `src/app/(public)/c/[slug]/page.tsx`

- [ ] **Step 1: public 레이아웃**

Create `src/app/(public)/layout.tsx`:
```tsx
import { requireTenant } from "@/lib/tenant/context";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const tenant = await requireTenant();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="h-14 border-b border-[var(--border)] flex items-center px-6">
        <a href="/" className="font-semibold">{tenant.name}</a>
      </header>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: 캠페인 상세**

Create `src/app/(public)/c/[slug]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ProgressBar } from "@/components/campaign/progress-bar";
import { Button } from "@/components/ui/button";

export default async function CampaignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!campaign) notFound();

  const { data: paid } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", tenant.id)
    .eq("campaign_id", campaign.id)
    .eq("pay_status", "paid");

  const current = (paid ?? []).reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      {campaign.thumbnail_url && (
        <div
          className="h-64 rounded-xl bg-cover bg-center mb-8"
          style={{ backgroundImage: `url(${campaign.thumbnail_url})` }}
        />
      )}
      <h1 className="text-3xl font-bold mb-4">{campaign.title}</h1>
      {campaign.description && <p className="text-[var(--muted)] mb-6">{campaign.description}</p>}
      {campaign.goal_amount && (
        <div className="mb-8">
          <ProgressBar current={current} goal={campaign.goal_amount} />
        </div>
      )}
      <Button size="lg" className="w-full" asChild>
        <a href={`/c/${campaign.slug}/apply`}>후원하기</a>
      </Button>
    </main>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(public)/"
git commit -m "feat(public): 캠페인 공개 상세 페이지 + 진행률 표시"
```

## Task D4: 캠페인 관리자 CRUD

**Files:**
- Create: `src/app/api/admin/campaigns/route.ts`, `[id]/route.ts`
- Create: `src/app/(admin)/admin/campaigns/page.tsx`

- [ ] **Step 1: 목록/생성 API**

Create `src/app/api/admin/campaigns/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const { tenant } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaigns: data });
}

export async function POST(req: NextRequest) {
  const { tenant } = await requireAdmin();
  const body = await req.json();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      org_id: tenant.id,
      slug: body.slug,
      title: body.title,
      description: body.description,
      donation_type: body.donation_type,
      goal_amount: body.goal_amount,
      preset_amounts: body.preset_amounts,
      status: body.status ?? "draft",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}
```

- [ ] **Step 2: 상세/수정/삭제 API**

Create `src/app/api/admin/campaigns/[id]/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ campaign: data });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdmin();
  const { id } = await params;
  const body = await req.json();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("org_id", tenant.id)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ campaign: data });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("org_id", tenant.id)
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 목록 페이지**

Create `src/app/(admin)/admin/campaigns/page.tsx`:
```tsx
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function CampaignsListPage() {
  const { tenant } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .eq("org_id", tenant.id)
    .order("created_at", { ascending: false });

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">캠페인 관리</h1>
        <Button asChild>
          <Link href="/admin/campaigns/new">+ 캠페인 등록</Link>
        </Button>
      </div>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full">
          <thead className="bg-[var(--surface-2)]">
            <tr className="text-left text-xs text-[var(--muted)]">
              <th className="px-4 py-3">제목</th>
              <th className="px-4 py-3">유형</th>
              <th className="px-4 py-3">목표</th>
              <th className="px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {(campaigns ?? []).map((c) => (
              <tr key={c.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
                <td className="px-4 py-3">
                  <Link href={`/admin/campaigns/${c.id}`} className="hover:text-[var(--accent)]">
                    {c.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{c.donation_type}</td>
                <td className="px-4 py-3 text-sm">{c.goal_amount?.toLocaleString() ?? "-"}</td>
                <td className="px-4 py-3">
                  <Badge variant={c.status === "active" ? "default" : "secondary"}>{c.status}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/campaigns/" src/app/api/admin/campaigns/
git commit -m "feat(admin): 캠페인 CRUD API + 목록 페이지"
```

---

# Phase 1.E — 결제 통합 + 후원 플로우

## Task E1: Toss 클라이언트 래퍼

**Files:**
- Create: `src/lib/toss/types.ts`, `client.ts`, `webhook.ts`, `tests/unit/toss-webhook.test.ts`

- [ ] **Step 1: 타입**

Create `src/lib/toss/types.ts`:
```ts
export type TossConfirmRequest = {
  paymentKey: string;
  orderId: string;
  amount: number;
};

export type TossConfirmResponse = {
  paymentKey: string;
  orderId: string;
  status: "DONE" | "CANCELED" | "ABORTED" | "FAILED";
  method: string;
  totalAmount: number;
  approvedAt: string;
};
```

- [ ] **Step 2: 결제 승인 클라이언트**

Create `src/lib/toss/client.ts`:
```ts
import type { TossConfirmRequest, TossConfirmResponse } from "./types";

const TOSS_API = "https://api.tosspayments.com/v1";

function authHeader() {
  const secret = process.env.TOSS_SECRET_KEY!;
  return "Basic " + Buffer.from(secret + ":").toString("base64");
}

export async function confirmPayment(req: TossConfirmRequest): Promise<TossConfirmResponse> {
  const res = await fetch(`${TOSS_API}/payments/confirm`, {
    method: "POST",
    headers: {
      Authorization: authHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Toss confirm failed: ${err.message || res.statusText}`);
  }
  return res.json();
}
```

- [ ] **Step 3: 웹훅 검증 실패 테스트**

Create `tests/unit/toss-webhook.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { verifyWebhookSignature } from "@/lib/toss/webhook";
import crypto from "node:crypto";

describe("verifyWebhookSignature", () => {
  const secret = "test-secret";

  it("유효한 서명을 통과시킨다", () => {
    const body = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
  });

  it("잘못된 서명을 거부한다", () => {
    expect(verifyWebhookSignature("{}", "invalid", secret)).toBe(false);
  });
});
```

Run: `npx vitest run tests/unit/toss-webhook.test.ts`
Expected: FAIL

- [ ] **Step 4: 웹훅 검증 구현**

Create `src/lib/toss/webhook.ts`:
```ts
import crypto from "node:crypto";

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expected, "hex")
    );
  } catch {
    return false;
  }
}
```

Run: `npx vitest run tests/unit/toss-webhook.test.ts`
Expected: 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/toss/ tests/unit/toss-webhook.test.ts
git commit -m "feat(toss): 결제 승인 클라이언트 + 웹훅 HMAC 검증"
```

## Task E2: 결제 승인 API

**Files:**
- Create: `src/app/api/payments/confirm/route.ts`

- [ ] **Step 1: API 작성**

Create `src/app/api/payments/confirm/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { confirmPayment } from "@/lib/toss/client";
import { generateMemberCode, generatePaymentCode, generatePromiseCode } from "@/lib/codes";

export async function POST(req: NextRequest) {
  const tenant = await requireTenant();
  const body = await req.json();
  const { paymentKey, orderId, amount, campaignId, donor, type } = body;

  const supabase = createSupabaseAdminClient();

  const tossRes = await confirmPayment({ paymentKey, orderId, amount });
  if (tossRes.status !== "DONE") {
    return NextResponse.json({ error: "결제가 완료되지 않았습니다" }, { status: 400 });
  }

  const year = new Date().getFullYear();

  const { count: memberCount } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const memberCode = generateMemberCode(year, (memberCount ?? 0) + 1);
  const { data: member, error: memberErr } = await supabase
    .from("members")
    .insert({
      org_id: tenant.id,
      member_code: memberCode,
      name: donor.name,
      phone: donor.phone,
      email: donor.email,
      join_path: "web",
    })
    .select()
    .single();

  if (memberErr) return NextResponse.json({ error: memberErr.message }, { status: 500 });

  const { count: promiseCount } = await supabase
    .from("promises")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const promiseCode = generatePromiseCode(year, (promiseCount ?? 0) + 1);
  const { data: promise } = await supabase
    .from("promises")
    .insert({
      org_id: tenant.id,
      promise_code: promiseCode,
      member_id: member.id,
      campaign_id: campaignId,
      type,
      amount,
      pay_method: tossRes.method,
      started_at: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();

  const { count: paymentCount } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id);

  const paymentCode = generatePaymentCode(year, (paymentCount ?? 0) + 1);
  const { data: payment } = await supabase
    .from("payments")
    .insert({
      org_id: tenant.id,
      payment_code: paymentCode,
      member_id: member.id,
      promise_id: promise?.id,
      campaign_id: campaignId,
      amount,
      pay_date: new Date().toISOString().slice(0, 10),
      deposit_date: new Date().toISOString(),
      pay_status: "paid",
      pg_tx_id: tossRes.paymentKey,
      pg_method: tossRes.method,
    })
    .select()
    .single();

  return NextResponse.json({ ok: true, paymentId: payment?.id });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/payments/
git commit -m "feat(payments): 결제 승인 API (Toss 승인 + 후원자/약정/납입 생성)"
```

## Task E3: 후원 신청 폼 + 완료 페이지

**Files:**
- Create: `src/components/campaign/donation-form.tsx`, `src/app/(public)/c/[slug]/apply/page.tsx`, `done/page.tsx`

- [ ] **Step 1: DonationForm**

Create `src/components/campaign/donation-form.tsx`:
```tsx
"use client";
import { useState } from "react";
import { loadTossPayments } from "@tosspayments/payment-sdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  campaignId: string;
  campaignSlug: string;
  presetAmounts?: number[];
};

export function DonationForm({ campaignId, campaignSlug, presetAmounts = [10000, 30000, 50000, 100000] }: Props) {
  const [amount, setAmount] = useState(presetAmounts[0]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const orderId = `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("donation-context", JSON.stringify({
      campaignId, type: "onetime", donor: { name, phone, email },
    }));

    const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
    await toss.requestPayment("카드", {
      amount,
      orderId,
      orderName: `후원 - ${name}`,
      customerName: name,
      customerEmail: email,
      successUrl: `${window.location.origin}/c/${campaignSlug}/done`,
      failUrl: `${window.location.origin}/c/${campaignSlug}/apply?failed=1`,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label className="mb-2 block">후원 금액</Label>
        <div className="grid grid-cols-4 gap-2 mb-2">
          {presetAmounts.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setAmount(a)}
              className="py-2 rounded-md border"
              style={{
                borderColor: amount === a ? "var(--accent)" : "var(--border)",
                backgroundColor: amount === a ? "var(--accent-soft)" : "transparent",
              }}
            >
              {(a / 10000).toFixed(0)}만원
            </button>
          ))}
        </div>
        <Input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min={1000}
          step={1000}
        />
      </div>
      <div>
        <Label htmlFor="name">이름</Label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="phone">연락처</Label>
        <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required />
      </div>
      <div>
        <Label htmlFor="email">이메일</Label>
        <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? "처리 중..." : `${amount.toLocaleString()}원 후원하기`}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: 신청 페이지**

Create `src/app/(public)/c/[slug]/apply/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireTenant } from "@/lib/tenant/context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DonationForm } from "@/components/campaign/donation-form";

export default async function ApplyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, preset_amounts")
    .eq("org_id", tenant.id)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();

  if (!campaign) notFound();

  return (
    <main className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-6">{campaign.title}</h1>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <DonationForm
          campaignId={campaign.id}
          campaignSlug={slug}
          presetAmounts={campaign.preset_amounts ?? undefined}
        />
      </div>
    </main>
  );
}
```

- [ ] **Step 3: 완료 페이지**

Create `src/app/(public)/c/[slug]/done/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function DonePage() {
  const params = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const paymentKey = params.get("paymentKey");
    const orderId = params.get("orderId");
    const amount = params.get("amount");
    if (!paymentKey || !orderId || !amount) return;

    const ctx = JSON.parse(sessionStorage.getItem("donation-context") || "{}");

    fetch("/api/payments/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentKey,
        orderId,
        amount: Number(amount),
        ...ctx,
      }),
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        setStatus("success");
        sessionStorage.removeItem("donation-context");
      })
      .catch((e) => {
        setStatus("error");
        setMessage(e.message);
      });
  }, [params]);

  return (
    <main className="max-w-md mx-auto px-6 py-20 text-center">
      {status === "processing" && <p>결제를 확인하고 있습니다...</p>}
      {status === "success" && (
        <>
          <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--positive)" }}>
            후원해 주셔서 감사합니다
          </h1>
          <p className="text-[var(--muted)]">따뜻한 마음에 깊이 감사드립니다.</p>
        </>
      )}
      {status === "error" && (
        <>
          <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--negative)" }}>
            결제 실패
          </h1>
          <p className="text-[var(--muted)]">{message}</p>
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(public)/c/" src/components/campaign/donation-form.tsx
git commit -m "feat(donation): 후원 신청 폼 + Toss 결제창 + 완료 페이지"
```

## Task E4: Toss 웹훅 수신 API

**Files:**
- Create: `src/app/api/webhooks/toss/route.ts`

- [ ] **Step 1: 웹훅 라우트**

Create `src/app/api/webhooks/toss/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { verifyWebhookSignature } from "@/lib/toss/webhook";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("toss-signature") || "";
  const secret = process.env.TOSS_WEBHOOK_SECRET!;

  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(rawBody);
  const supabase = createSupabaseAdminClient();

  switch (event.eventType) {
    case "PAYMENT_STATUS_CHANGED": {
      const { paymentKey, status, method } = event.data;
      const payStatus = status === "DONE" ? "paid" : status === "CANCELED" ? "cancelled" : "failed";
      await supabase
        .from("payments")
        .update({
          pay_status: payStatus,
          pg_method: method,
          deposit_date: status === "DONE" ? new Date().toISOString() : null,
        })
        .eq("pg_tx_id", paymentKey);
      break;
    }
    case "CMS_PAYMENT_SUCCEEDED":
    case "CMS_PAYMENT_FAILED": {
      const { paymentKey, status, failureReason } = event.data;
      await supabase
        .from("payments")
        .update({
          pay_status: status === "succeeded" ? "paid" : "failed",
          fail_reason: failureReason ?? null,
          deposit_date: status === "succeeded" ? new Date().toISOString() : null,
        })
        .eq("pg_tx_id", paymentKey);
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/webhooks/
git commit -m "feat(webhook): Toss 웹훅 수신 — 결제 상태 변경/CMS 처리"
```

---

# Phase 1.F — 후원자 관리 + 마이페이지

## Task F1: 후원자 목록 페이지

**Files:**
- Create: `src/components/donors/donor-filter-bar.tsx`, `donor-table.tsx`, `src/app/(admin)/admin/donors/page.tsx`

- [ ] **Step 1: 필터 바**

Create `src/components/donors/donor-filter-bar.tsx`:
```tsx
"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";

export function DonorFilterBar() {
  const router = useRouter();
  const params = useSearchParams();

  function updateQuery(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`/admin/donors?${next.toString()}`);
  }

  return (
    <div className="flex gap-2 mb-4">
      <Input
        placeholder="이름/전화/이메일 검색"
        defaultValue={params.get("q") ?? ""}
        onBlur={(e) => updateQuery("q", e.target.value)}
        className="max-w-sm"
      />
    </div>
  );
}
```

- [ ] **Step 2: 테이블**

Create `src/components/donors/donor-table.tsx`:
```tsx
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Donor = {
  id: string;
  member_code: string;
  name: string;
  phone: string | null;
  email: string | null;
  status: string;
  created_at: string;
};

export function DonorTable({ donors }: { donors: Donor[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <table className="w-full">
        <thead className="bg-[var(--surface-2)]">
          <tr className="text-left text-xs text-[var(--muted)]">
            <th className="px-4 py-3">코드</th>
            <th className="px-4 py-3">이름</th>
            <th className="px-4 py-3">연락처</th>
            <th className="px-4 py-3">이메일</th>
            <th className="px-4 py-3">상태</th>
            <th className="px-4 py-3">등록일</th>
          </tr>
        </thead>
        <tbody>
          {donors.map((d) => (
            <tr key={d.id} className="border-t border-[var(--border)] hover:bg-[var(--surface-2)]">
              <td className="px-4 py-3 text-sm text-[var(--muted)]">{d.member_code}</td>
              <td className="px-4 py-3">
                <Link href={`/admin/donors/${d.id}`} className="hover:text-[var(--accent)]">
                  {d.name}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm">{d.phone ?? "-"}</td>
              <td className="px-4 py-3 text-sm">{d.email ?? "-"}</td>
              <td className="px-4 py-3">
                <Badge variant={d.status === "active" ? "default" : "secondary"}>{d.status}</Badge>
              </td>
              <td className="px-4 py-3 text-sm text-[var(--muted)]">
                {new Date(d.created_at).toLocaleDateString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: 목록 페이지**

Create `src/app/(admin)/admin/donors/page.tsx`:
```tsx
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DonorFilterBar } from "@/components/donors/donor-filter-bar";
import { DonorTable } from "@/components/donors/donor-table";

export default async function DonorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { tenant } = await requireAdmin();
  const { q } = await searchParams;
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("members").select("*").eq("org_id", tenant.id).order("created_at", { ascending: false }).limit(50);
  if (q) {
    query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  }
  const { data: donors } = await query;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">후원자 관리</h1>
      <DonorFilterBar />
      <DonorTable donors={donors ?? []} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/donors/" src/components/donors/
git commit -m "feat(donors): 후원자 목록 + 필터 + 테이블"
```

## Task F2: 후원자 상세 (5탭)

**Files:**
- Create: `src/components/donors/donor-detail-tabs.tsx`, `src/app/(admin)/admin/donors/[id]/page.tsx`

- [ ] **Step 1: 탭 컴포넌트**

Create `src/components/donors/donor-detail-tabs.tsx`:
```tsx
"use client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Promise = { id: string; promise_code: string; type: string; amount: number; status: string };
type Payment = { id: string; payment_code: string; pay_date: string; amount: number; pay_status: string };

export function DonorDetailTabs({ promises, payments }: { promises: Promise[]; payments: Payment[] }) {
  return (
    <Tabs defaultValue="promises">
      <TabsList>
        <TabsTrigger value="promises">약정 현황</TabsTrigger>
        <TabsTrigger value="payments">납입 내역</TabsTrigger>
        <TabsTrigger value="receipts">기부금 영수증</TabsTrigger>
        <TabsTrigger value="notes">메모</TabsTrigger>
        <TabsTrigger value="history">변경 이력</TabsTrigger>
      </TabsList>

      <TabsContent value="promises" className="mt-4">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr><th className="py-2">코드</th><th>유형</th><th>금액</th><th>상태</th></tr>
          </thead>
          <tbody>
            {promises.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="py-2">{p.promise_code}</td>
                <td>{p.type === "regular" ? "정기" : "일시"}</td>
                <td>{p.amount.toLocaleString()}원</td>
                <td>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="payments" className="mt-4">
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--muted)]">
            <tr><th className="py-2">납입일</th><th>코드</th><th>금액</th><th>상태</th></tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-[var(--border)]">
                <td className="py-2">{p.pay_date}</td>
                <td>{p.payment_code}</td>
                <td>{p.amount.toLocaleString()}원</td>
                <td>{p.pay_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="receipts" className="mt-4">
        <p className="text-[var(--muted)]">영수증 발행은 재무·영수증 메뉴에서 진행합니다.</p>
      </TabsContent>
      <TabsContent value="notes" className="mt-4">
        <p className="text-[var(--muted)]">메모 기능은 Phase 2에서 제공됩니다.</p>
      </TabsContent>
      <TabsContent value="history" className="mt-4">
        <p className="text-[var(--muted)]">변경 이력은 Phase 2에서 제공됩니다.</p>
      </TabsContent>
    </Tabs>
  );
}
```

- [ ] **Step 2: 상세 페이지**

Create `src/app/(admin)/admin/donors/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DonorDetailTabs } from "@/components/donors/donor-detail-tabs";

export default async function DonorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenant } = await requireAdmin();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: donor } = await supabase
    .from("members")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("id", id)
    .maybeSingle();

  if (!donor) notFound();

  const { data: promises } = await supabase
    .from("promises")
    .select("id, promise_code, type, amount, status")
    .eq("member_id", id)
    .order("created_at", { ascending: false });

  const { data: payments } = await supabase
    .from("payments")
    .select("id, payment_code, pay_date, amount, pay_status")
    .eq("member_id", id)
    .order("pay_date", { ascending: false });

  return (
    <div className="p-8">
      <div className="grid grid-cols-[320px_1fr] gap-6">
        <aside className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-3">
          <div>
            <div className="text-xs text-[var(--muted)]">코드</div>
            <div className="font-mono">{donor.member_code}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">이름</div>
            <div className="text-lg font-semibold">{donor.name}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">연락처</div>
            <div>{donor.phone ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">이메일</div>
            <div>{donor.email ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-[var(--muted)]">유입 경로</div>
            <div>{donor.join_path ?? "-"}</div>
          </div>
        </aside>
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <DonorDetailTabs promises={promises ?? []} payments={payments ?? []} />
        </section>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add "src/app/(admin)/admin/donors/[id]/" src/components/donors/donor-detail-tabs.tsx
git commit -m "feat(donors): 후원자 상세 + 5탭 (약정/납입/영수증/메모/이력)"
```

## Task F3: 후원자 마이페이지 + 홈

**Files:**
- Create: `src/lib/auth/require-donor.ts`, `src/app/(donor)/layout.tsx`, `src/app/(donor)/my/page.tsx`

- [ ] **Step 1: 후원자 가드**

Create `src/lib/auth/require-donor.ts`:
```ts
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireTenant } from "@/lib/tenant/context";

export async function requireDonor() {
  const tenant = await requireTenant();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login?next=/my");

  const { data: member } = await supabase
    .from("members")
    .select("*")
    .eq("org_id", tenant.id)
    .eq("supabase_uid", user.id)
    .maybeSingle();

  if (!member) redirect("/auth/login?error=no-member");
  return { user, tenant, member };
}
```

- [ ] **Step 2: 마이페이지 레이아웃**

Create `src/app/(donor)/layout.tsx`:
```tsx
import Link from "next/link";
import { requireDonor } from "@/lib/auth/require-donor";

export default async function DonorLayout({ children }: { children: React.ReactNode }) {
  const { member, tenant } = await requireDonor();
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-6">
        <Link href="/" className="font-semibold">{tenant.name}</Link>
        <span className="text-sm text-[var(--muted)]">{member.name}님</span>
      </header>
      <div className="grid grid-cols-[220px_1fr] max-w-6xl mx-auto">
        <nav className="border-r border-[var(--border)] p-4 space-y-1">
          <Link href="/my" className="block px-3 py-2 rounded-md hover:bg-[var(--surface-2)]">내 후원 현황</Link>
          <Link href="/my/payments" className="block px-3 py-2 rounded-md hover:bg-[var(--surface-2)]">납입 내역</Link>
          <Link href="/my/subscriptions" className="block px-3 py-2 rounded-md hover:bg-[var(--surface-2)]">약정 현황</Link>
          <Link href="/my/receipts" className="block px-3 py-2 rounded-md hover:bg-[var(--surface-2)]">기부금 영수증</Link>
          <Link href="/my/profile" className="block px-3 py-2 rounded-md hover:bg-[var(--surface-2)]">프로필 설정</Link>
        </nav>
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 마이페이지 홈**

Create `src/app/(donor)/my/page.tsx`:
```tsx
import { requireDonor } from "@/lib/auth/require-donor";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function MyHomePage() {
  const { member } = await requireDonor();
  const supabase = await createSupabaseServerClient();

  const year = new Date().getFullYear();
  const { data: payments } = await supabase
    .from("payments")
    .select("amount, pay_date, pay_status")
    .eq("member_id", member.id)
    .gte("pay_date", `${year}-01-01`)
    .eq("pay_status", "paid");

  const total = (payments ?? []).reduce((sum, p) => sum + p.amount, 0);
  const count = (payments ?? []).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">내 후원 현황</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-xs text-[var(--muted)]">올해 총 후원액</div>
          <div className="text-3xl font-bold text-[var(--accent)] mt-2">
            {total.toLocaleString()}원
          </div>
        </div>
        <div className="p-6 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="text-xs text-[var(--muted)]">납입 횟수</div>
          <div className="text-3xl font-bold mt-2">{count}회</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth/require-donor.ts "src/app/(donor)/"
git commit -m "feat(donor): 후원자 마이페이지 레이아웃 + 홈 (올해 요약)"
```

---

# Phase 1.G — 영수증 + 대시보드

## Task G1: PDF 영수증 템플릿

**Files:**
- Create: `src/lib/pdf/receipt-doc.ts`, `src/lib/pdf/generate-receipt.ts`
- Create: `public/fonts/NotoSansKR-Regular.ttf`, `public/fonts/NotoSansKR-Bold.ttf` (한글 폰트)

- [ ] **Step 0: 한글 폰트 다운로드**

Run:
```bash
cd /Users/gloryinside/NPO_S
mkdir -p public/fonts
curl -L -o public/fonts/NotoSansKR-Regular.ttf "https://github.com/google/fonts/raw/main/ofl/notosanskr/NotoSansKR%5Bwght%5D.ttf"
```

For bold weight, use the same variable font (pdfmake can use it for both normal and bold via font variation):
```bash
cp public/fonts/NotoSansKR-Regular.ttf public/fonts/NotoSansKR-Bold.ttf
```

(향후 별도 Bold 폰트를 원하면 `NotoSansKR-Bold.ttf`를 교체.)

- [ ] **Step 1: 영수증 문서 정의 생성기**

Create `src/lib/pdf/receipt-doc.ts`:
```ts
import type { TDocumentDefinitions } from "pdfmake/interfaces";

export type ReceiptData = {
  receiptCode: string;
  year: number;
  org: { name: string; business_no: string | null; address: string | null };
  member: { name: string; birth_date: string | null; address: string | null };
  totalAmount: number;
  payments: Array<{ pay_date: string; amount: number; campaign_title: string }>;
};

export function buildReceiptDocDefinition(data: ReceiptData): TDocumentDefinitions {
  return {
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
    defaultStyle: { font: "NotoSansKR", fontSize: 10 },
    content: [
      { text: "기부금 영수증", fontSize: 18, bold: true, alignment: "center", margin: [0, 0, 0, 20] },

      {
        columns: [
          { text: "영수증 번호:", bold: true, width: 100 },
          { text: data.receiptCode },
        ],
        margin: [0, 0, 0, 4],
      },
      {
        columns: [
          { text: "귀속 연도:", bold: true, width: 100 },
          { text: `${data.year}년` },
        ],
        margin: [0, 0, 0, 12],
      },

      { text: "기부자", bold: true, margin: [0, 0, 0, 4] },
      { text: `성명: ${data.member.name}` },
      { text: `생년월일: ${data.member.birth_date ?? "-"}`, margin: [0, 0, 0, 12] },

      { text: "기부금을 받는 단체", bold: true, margin: [0, 0, 0, 4] },
      { text: `단체명: ${data.org.name}` },
      { text: `사업자등록번호: ${data.org.business_no ?? "-"}`, margin: [0, 0, 0, 12] },

      {
        table: {
          headerRows: 1,
          widths: ["*", "*", "*"],
          body: [
            [
              { text: "기부일자", bold: true },
              { text: "캠페인", bold: true },
              { text: "금액", bold: true },
            ],
            ...data.payments.map((p) => [
              p.pay_date,
              p.campaign_title,
              `${p.amount.toLocaleString()}원`,
            ]),
          ],
        },
        margin: [0, 0, 0, 12],
      },

      {
        text: `총 합계: ${data.totalAmount.toLocaleString()}원`,
        bold: true,
        alignment: "right",
      },
    ],
  };
}
```

- [ ] **Step 2: PDF 생성 함수 (한글 폰트 임베딩)**

Create `src/lib/pdf/generate-receipt.ts`:
```ts
import PdfPrinter from "pdfmake";
import path from "node:path";
import { buildReceiptDocDefinition, type ReceiptData } from "./receipt-doc";

// 한글 렌더링을 위해 Noto Sans KR 폰트를 번들에 포함시킨다.
// Phase 1.A에서 public/fonts/ 에 다운로드해둔 NotoSansKR-Regular.ttf / -Bold.ttf 사용.
const FONTS_DIR = path.join(process.cwd(), "public", "fonts");

const fonts = {
  NotoSansKR: {
    normal: path.join(FONTS_DIR, "NotoSansKR-Regular.ttf"),
    bold: path.join(FONTS_DIR, "NotoSansKR-Bold.ttf"),
  },
};

export async function generateReceiptPdf(data: ReceiptData): Promise<Buffer> {
  const printer = new PdfPrinter(fonts);
  const doc = printer.createPdfKitDocument(buildReceiptDocDefinition(data));

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/pdf/ public/fonts/
git commit -m "feat(receipt): pdfmake 기부금 영수증 템플릿 + 한글 폰트"
```

## Task G2: 영수증 발행 API + 이력 페이지

**Files:**
- Create: `src/app/api/receipts/generate/route.ts`, `src/app/(admin)/admin/receipts/page.tsx`

- [ ] **Step 1: Storage 버킷 생성**

Run (Supabase SQL):
```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', false)
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: 발행 API**

Create `src/app/api/receipts/generate/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { generateReceiptPdf } from "@/lib/pdf/generate-receipt";
import { generateReceiptCode } from "@/lib/codes";

export async function POST(req: NextRequest) {
  const { tenant, user } = await requireAdmin();
  const { memberId, year } = await req.json();
  const supabase = createSupabaseAdminClient();

  const { data: org } = await supabase.from("orgs").select("*").eq("id", tenant.id).single();
  const { data: member } = await supabase.from("members").select("*").eq("id", memberId).single();

  const { data: payments } = await supabase
    .from("payments")
    .select("pay_date, amount, campaigns(title)")
    .eq("member_id", memberId)
    .eq("pay_status", "paid")
    .gte("pay_date", `${year}-01-01`)
    .lte("pay_date", `${year}-12-31`);

  if (!payments || payments.length === 0) {
    return NextResponse.json({ error: "해당 연도의 납입 내역이 없습니다" }, { status: 400 });
  }

  const total = payments.reduce((sum, p) => sum + p.amount, 0);

  const { count } = await supabase
    .from("receipts")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .eq("year", year);

  const receiptCode = generateReceiptCode(year, (count ?? 0) + 1);

  const pdfBuffer = await generateReceiptPdf({
    receiptCode,
    year,
    org: { name: org.name, business_no: org.business_no, address: org.address },
    member: { name: member.name, birth_date: member.birth_date, address: null },
    totalAmount: total,
    payments: payments.map((p: any) => ({
      pay_date: p.pay_date,
      amount: p.amount,
      campaign_title: p.campaigns?.title ?? "-",
    })),
  });

  const path = `${tenant.id}/${year}/${receiptCode}.pdf`;
  const { error: uploadErr } = await supabase.storage
    .from("receipts")
    .upload(path, pdfBuffer, { contentType: "application/pdf", upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: receipt } = await supabase
    .from("receipts")
    .insert({
      org_id: tenant.id,
      receipt_code: receiptCode,
      member_id: memberId,
      year,
      total_amount: total,
      pdf_url: path,
      issued_at: new Date().toISOString(),
      issued_by: user.id,
    })
    .select()
    .single();

  return NextResponse.json({ receipt });
}
```

- [ ] **Step 3: 이력 페이지**

Create `src/app/(admin)/admin/receipts/page.tsx`:
```tsx
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ReceiptsPage() {
  const { tenant } = await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const { data: receipts } = await supabase
    .from("receipts")
    .select("*, members(name, member_code)")
    .eq("org_id", tenant.id)
    .order("issued_at", { ascending: false });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">영수증 이력</h1>
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[var(--surface-2)] text-xs text-[var(--muted)]">
            <tr>
              <th className="px-4 py-3 text-left">번호</th>
              <th className="px-4 py-3 text-left">기부자</th>
              <th className="px-4 py-3 text-left">연도</th>
              <th className="px-4 py-3 text-left">금액</th>
              <th className="px-4 py-3 text-left">발행일</th>
            </tr>
          </thead>
          <tbody>
            {(receipts ?? []).map((r: any) => (
              <tr key={r.id} className="border-t border-[var(--border)]">
                <td className="px-4 py-3 font-mono">{r.receipt_code}</td>
                <td className="px-4 py-3">{r.members?.name}</td>
                <td className="px-4 py-3">{r.year}</td>
                <td className="px-4 py-3">{r.total_amount.toLocaleString()}원</td>
                <td className="px-4 py-3 text-[var(--muted)]">
                  {r.issued_at ? new Date(r.issued_at).toLocaleDateString("ko-KR") : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/receipts/ "src/app/(admin)/admin/receipts/"
git commit -m "feat(receipt): 영수증 발행 API + Supabase Storage 업로드 + 이력 페이지"
```

## Task G3: 대시보드 KPI + 미납 리스트

**Files:**
- Create: `src/components/dashboard/kpi-card.tsx`, `unpaid-list.tsx`, `src/app/(admin)/admin/page.tsx`

- [ ] **Step 1: KpiCard**

Create `src/components/dashboard/kpi-card.tsx`:
```tsx
type Props = {
  label: string;
  value: string;
  delta?: { value: string; tone: "positive" | "negative" };
};

export function KpiCard({ label, value, delta }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="text-xs text-[var(--muted)] uppercase">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
      {delta && (
        <div className="text-xs mt-1" style={{ color: `var(--${delta.tone})` }}>
          {delta.value}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: UnpaidList**

Create `src/components/dashboard/unpaid-list.tsx`:
```tsx
import Link from "next/link";

type Unpaid = {
  id: string;
  member_name: string;
  amount: number;
  pay_date: string;
  days_overdue: number;
};

export function UnpaidList({ items }: { items: Unpaid[] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">미납 알림</h3>
        <Link href="/admin/unpaid" className="text-xs text-[var(--accent)]">전체 보기 →</Link>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">미납 건이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <div>
                <div>{u.member_name}</div>
                <div className="text-xs text-[var(--muted)]">{u.pay_date} · {u.days_overdue}일 경과</div>
              </div>
              <div className="text-[var(--negative)] font-semibold">
                {u.amount.toLocaleString()}원
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 대시보드 페이지**

Create `src/app/(admin)/admin/page.tsx`:
```tsx
import { requireAdmin } from "@/lib/auth/require-admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { UnpaidList } from "@/components/dashboard/unpaid-list";

export default async function DashboardPage() {
  const { tenant } = await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  const { data: monthPayments } = await supabase
    .from("payments")
    .select("amount")
    .eq("org_id", tenant.id)
    .eq("pay_status", "paid")
    .gte("pay_date", monthStart);

  const monthTotal = (monthPayments ?? []).reduce((sum, p) => sum + p.amount, 0);

  const { count: activeDonors } = await supabase
    .from("members")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .eq("status", "active");

  const { count: unpaidCount } = await supabase
    .from("payments")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .in("pay_status", ["unpaid", "failed"]);

  const { data: unpaidItems } = await supabase
    .from("payments")
    .select("id, amount, pay_date, members(name)")
    .eq("org_id", tenant.id)
    .in("pay_status", ["unpaid", "failed"])
    .order("pay_date", { ascending: true })
    .limit(10);

  const unpaidFormatted = (unpaidItems ?? []).map((u: any) => ({
    id: u.id,
    member_name: u.members?.name ?? "-",
    amount: u.amount,
    pay_date: u.pay_date,
    days_overdue: Math.max(0, Math.floor((Date.now() - new Date(u.pay_date).getTime()) / 86400000)),
  }));

  const { count: newPromisesThisMonth } = await supabase
    .from("promises")
    .select("*", { count: "exact", head: true })
    .eq("org_id", tenant.id)
    .gte("created_at", new Date(now.getFullYear(), now.getMonth(), 1).toISOString());

  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">대시보드</h1>
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="이달 후원금" value={`${monthTotal.toLocaleString()}원`} />
        <KpiCard label="활성 후원자" value={`${activeDonors ?? 0}명`} />
        <KpiCard
          label="미납 건수"
          value={`${unpaidCount ?? 0}건`}
          delta={unpaidCount ? { value: "확인 필요", tone: "negative" } : undefined}
        />
        <KpiCard label="이달 신규 약정" value={`${newPromisesThisMonth ?? 0}건`} />
      </div>
      <UnpaidList items={unpaidFormatted} />
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add "src/app/(admin)/admin/page.tsx" src/components/dashboard/
git commit -m "feat(dashboard): KPI 4종 + 미납 알림 리스트"
```

## Task G4: E2E 테스트 — 랜딩 플로우

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/donation-flow.spec.ts`

- [ ] **Step 1: Playwright 초기화**

Run: `npx playwright install chromium`

Create `playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  use: {
    baseURL: "http://demo.localhost:3000",
    headless: true,
  },
  webServer: {
    command: "npm run dev",
    url: "http://demo.localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: E2E 테스트**

Create `tests/e2e/donation-flow.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test.describe("후원 플로우", () => {
  test("랜딩페이지에서 기관명이 표시된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /데모 복지재단/ })).toBeVisible();
  });

  test("캠페인 목록 섹션이 표시된다", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "진행 중인 캠페인" })).toBeVisible();
  });

  test("활성 캠페인 카드가 있으면 상세로 이동 가능하다", async ({ page }) => {
    await page.goto("/");
    const firstCampaign = page.locator("[href^='/c/']").first();
    if (await firstCampaign.count()) {
      await firstCampaign.click();
      await expect(page.getByRole("button", { name: /후원하기/ })).toBeVisible();
    }
  });
});
```

- [ ] **Step 3: 실행**

Run: `npx playwright test`
Expected: 3 tests pass

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/ playwright.config.ts
git commit -m "test(e2e): 랜딩페이지 + 캠페인 플로우 Playwright 테스트"
```

## Task G5: README 작성

**Files:**
- Create: `README.md`

- [ ] **Step 1: README**

Create `README.md`:
```markdown
# Supporters — NPO 후원관리 SaaS

비영리단체를 위한 멀티테넌트 후원관리 플랫폼.

## 기술 스택

- Next.js 15 (App Router) · React 19 · TypeScript
- Tailwind v4 · shadcn/ui (5색 의미 토큰 다크 테마)
- Supabase (Auth + Postgres + Storage + RLS)
- Toss Payments (PG + CMS 통합)
- pdfmake (영수증 생성)

## 설계 문서

- 명세서: `docs/superpowers/specs/2026-04-15-donation-system-design.md`
- 구현 계획: `docs/superpowers/plans/2026-04-15-donation-system-phase1.md`

## 개발 시작

```bash
cp .env.local.example .env.local
# Supabase URL/키 + Toss 키 입력

npx supabase db push
npm run dev
# http://demo.localhost:3000 (서브도메인 기반 테넌트 식별)
```

## 멀티테넌트 구조

- 서브도메인 `{slug}.supporters.kr`로 기관별 접근
- `src/middleware.ts`가 호스트를 파싱해 `x-tenant-id` 헤더 주입
- 모든 DB 테이블은 `org_id` + RLS로 테넌트 격리

## 테스트

- 단위: `npx vitest`
- E2E: `npx playwright test`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README 작성"
```

---

## Self-Review

**1. Spec 커버리지**

| Spec 섹션 | Task |
|-----------|------|
| 용어 정의 | B7 codes + 주석 반영 |
| SaaS 멀티테넌트 | B2, B3, B4, B5 (org_id), B6 (RLS) |
| 단체 랜딩페이지 | D1, D2 |
| 5색 디자인 토큰 | A2 |
| GNB 확장/축소 | C3 |
| 라우트 그룹 | C2, D1, D3, F3 |
| DB 스키마 (5+1 테이블) | B2, B5 |
| RLS 정책 | B6 |
| Toss 결제 통합 | E1, E2, E3, E4 |
| 캠페인 공개 랜딩 | D3 |
| 후원 신청 폼 | E3 |
| 후원자 목록/상세 | F1, F2 |
| 기부금 영수증 PDF | G1, G2 |
| 대시보드 KPI | G3 |
| 후원자 마이페이지 | F3 |
| XSS 방어 (sanitize) | B8, D2 |

**2. 플레이스홀더 스캔**

- F2 탭 중 notes/history는 "Phase 2에서 제공됩니다" 명시 — 의도적이며 계획 범위 외
- 모든 코드 블록에 실제 코드 제공
- TODO/TBD 없음

**3. 타입 일관성**

- `Tenant` (B3) → `resolveTenant/getTenant/requireTenant` 일관 사용
- `requireAdmin()` 반환 `{ user, tenant }` — C2 정의, 모든 admin route에서 동일 사용
- `generateMember/Promise/Payment/ReceiptCode` — B7 정의, E2/G2에서 동일 서명 호출
- `pay_status` enum 값 (B5의 CHECK constraint) — E2/E4/F1/F2/G3 모두 동일 문자열 사용
- `sanitizeHtml` (B8) → D2 AboutSection에서 호출

**4. 보안 체크**

- DOMPurify 기반 HTML 살균 (B8, D2)
- RLS 테넌트 격리 + 관리자/후원자 권한 분리 (B6)
- Toss 웹훅 HMAC 검증 (E1)
- middleware가 웹훅 경로를 matcher에서 제외 (B4)

---

## Execution Handoff

계획서를 `docs/superpowers/plans/2026-04-15-donation-system-phase1.md`에 저장했습니다.

**두 가지 실행 옵션:**

1. **Subagent-Driven (권장)** — 태스크마다 새 subagent 디스패치, 태스크 사이 리뷰
2. **Inline Execution** — 현재 세션에서 순차 실행, 체크포인트마다 리뷰

어떤 방식으로 진행하시겠습니까?
