# Sub-3: 정기후원 CMS — Toss Billing 자동결제 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정기후원 빌링키 발급 + 월간 자동���제 + 실패 재시도(1/3/7일) + 관리자 인앱·이메일 알림을 구현한다.

**Architecture:** `src/lib/billing/` 서비스 레이어에 Toss Billing API 래퍼, 월간 결제, 재시도 로직을 캡슐���. 기존 cron을 확장하여 빌링키 결제를 수행하고, 별도 재시도 cron을 추가. 관리자 알림은 `admin_notifications` 테이블 + 이메일 ��송.

**Tech Stack:** Next.js App Router, Supabase, Toss Payments Billing API (테스트키), Vercel Cron, Nodemailer (이메일)

---

## File Structure

### 신규 파일
| 파일 | 책임 |
|------|------|
| `supabase/migrations/20260417300001_payments_retry.sql` | payments에 retry_count, next_retry_at 추가 |
| `supabase/migrations/20260417300002_admin_notifications.sql` | admin_notifications 테이블 |
| `src/lib/billing/toss-billing.ts` | Toss Billing API 래퍼 (빌링키 발급, 자동결제) |
| `src/lib/billing/charge-service.ts` | 월간 자동결제 로직 |
| `src/lib/billing/retry-service.ts` | 실패 재시도 로직 |
| `src/lib/email/send-email.ts` | 이메일 발송 (Nodemailer SMTP) |
| `src/app/api/cron/retry-billing/route.ts` | 재시도 cron |
| `src/app/api/admin/notifications/route.ts` | 알림 목록 API |
| `src/app/api/admin/notifications/[id]/read/route.ts` | 읽음 처리 API |
| `src/app/api/admin/notifications/unread-count/route.ts` | 읽지 않은 개수 API |
| `src/app/(admin)/admin/notifications/page.tsx` | 알림 페이지 |
| `src/components/admin/notification-badge.tsx` | 네비게이션 알림 배지 |

### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/app/api/donations/prepare/route.ts` | 정기후원 시 빌링키 발급 추가 |
| `src/app/api/cron/process-payments/route.ts` | ���링키 자동결제 연동 |
| `src/app/donate/wizard/steps/Step2.tsx` | 정기후원 카드 정보 입력 필드 |
| `src/components/admin/sidebar.tsx` | 알림 배지 추가 |
| `vercel.json` | retry-billing cron 스케줄 추가 |

---

### Task 1: DB 마이그레이션 (payments retry + admin_notifications)

**Files:**
- Create: `supabase/migrations/20260417300001_payments_retry.sql`
- Create: `supabase/migrations/20260417300002_admin_notifications.sql`

- [ ] **Step 1: payments retry 컬럼 마이그레이션**

```sql
-- 결제 실패 재시도 지원
ALTER TABLE payments ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

CREATE INDEX idx_payments_retry ON payments(next_retry_at) WHERE pay_status = 'failed' AND retry_count < 3;

COMMENT ON COLUMN payments.retry_count IS '자동���제 재시도 횟수 (최대 3)';
COMMENT ON COLUMN payments.next_retry_at IS '다음 재시도 예정 시각';
```

- [ ] **Step 2: admin_notifications 테이블 마이그레이션**

```sql
-- 관리자 알림
CREATE TABLE IF NOT EXISTS admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  meta JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_notifications_org_unread ON admin_notifications(org_id) WHERE read = FALSE;

ALTER TABLE admin_notifications ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE admin_notifications IS '관리자 알림 (결제 실패, 약정 정지 등)';
```

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260417300001_payments_retry.sql supabase/migrations/20260417300002_admin_notifications.sql
git commit -m "feat(db): payments retry 컬럼 + admin_notifications 테이블"
```

---

### Task 2: Toss Billing API 래퍼

**Files:**
- Create: `src/lib/billing/toss-billing.ts`

- [ ] **Step 1: 모듈 작성**

```typescript
/**
 * Toss Payments Billing API 래퍼.
 * 테스���키 환경: POST /v1/billing/authorizations/card 로 빌링키 발급.
 * 실 서비스 전환 시 issueBillingKey만 인증 기반으로 교체.
 */

const TOSS_BASE = 'https://api.tosspayments.com/v1';

function authHeader(secretKey: string): string {
  return `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;
}

export type CardInfo = {
  cardNumber: string;       // 16자리
  cardExpirationYear: string;  // 2자리 (YY)
  cardExpirationMonth: string; // 2자리 (MM)
  cardPassword: string;     // 앞 2자리
  customerIdentityNumber: string; // 생년월일 6자리
};

export type BillingKeyResult = {
  success: true;
  billingKey: string;
  customerKey: string;
} | {
  success: false;
  error: string;
};

export async function issueBillingKey(
  secretKey: string,
  customerKey: string,
  cardInfo: CardInfo,
): Promise<BillingKeyResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/authorizations/card`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ customerKey, ...cardInfo }),
    });

    const data = await res.json();
    if (!res.ok) {
      return { success: false, error: data.message ?? '빌링키 발급 실패' };
    }
    return { success: true, billingKey: data.billingKey, customerKey: data.customerKey };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export type ChargeResult = {
  success: true;
  paymentKey: string;
} | {
  success: false;
  failureCode: string;
  failureMessage: string;
};

export async function chargeBillingKey(
  secretKey: string,
  billingKey: string,
  params: { customerKey: string; amount: number; orderId: string; orderName: string },
): Promise<ChargeResult> {
  try {
    const res = await fetch(`${TOSS_BASE}/billing/${billingKey}`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader(secretKey),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const data = await res.json();
    if (!res.ok || data.status === 'ABORTED' || data.status === 'EXPIRED') {
      return {
        success: false,
        failureCode: data.code ?? 'UNKNOWN',
        failureMessage: data.message ?? '결제 실패',
      };
    }
    return { success: true, paymentKey: data.paymentKey };
  } catch (err) {
    return { success: false, failureCode: 'NETWORK_ERROR', failureMessage: String(err) };
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/billing/toss-billing.ts
git commit -m "feat(billing): Toss Billing API 래퍼 — 빌링키 발급 + 자동결제"
```

---

### Task 3: 이메일 발송 모듈

**Files:**
- Create: `src/lib/email/send-email.ts`

- [ ] **Step 1: Nodemailer 설치 확인 + 모듈 작성**

`npm install nodemailer` (if not installed). `npm install -D @types/nodemailer`.

```typescript
import nodemailer from 'nodemailer';

/**
 * SMTP 이메일 발송.
 * 환경변수: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */
export async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; error?: string }> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.error('[email] SMTP 환경변수 미설정');
    return { success: false, error: 'SMTP 설정 누락' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT) || 587,
      secure: Number(SMTP_PORT) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: SMTP_FROM ?? SMTP_USER,
      to: params.to,
      subject: params.subject,
      html: params.html,
    });

    return { success: true };
  } catch (err) {
    console.error('[email] 발송 실패:', err);
    return { success: false, error: String(err) };
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/email/send-email.ts package.json package-lock.json
git commit -m "feat(email): Nodemailer SMTP 이메일 발송 모듈"
```

---

### Task 4: 월간 자동결제 서비스

**Files:**
- Create: `src/lib/billing/charge-service.ts`

- [ ] **Step 1: charge-service 작성**

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOrgTossKeys } from '@/lib/toss/keys';
import { chargeBillingKey } from './toss-billing';
import { generatePaymentCode } from '@/lib/codes';
import { createBillingFailedNotification } from './notifications';

/**
 * 특정 org의 오늘 pay_day에 해당하는 active 약정을 빌링키로 자동결제.
 * cron/process-payments에서 unpaid 행 생성 후 호출된다.
 */
export async function processMonthlyCharges(orgId: string): Promise<{ charged: number; failed: number }> {
  const supabase = createSupabaseAdminClient();
  const keys = await getOrgTossKeys(orgId);
  if (!keys.tossSecretKey) return { charged: 0, failed: 0 };

  // toss_billing_key가 있고 오늘 생성된 unpaid payments 조회
  const today = new Date().toISOString().slice(0, 10);
  const { data: payments } = await supabase
    .from('payments')
    .select('id, amount, promise_id, member_id, campaign_id, idempotency_key, promises!inner(toss_billing_key, customer_key)')
    .eq('org_id', orgId)
    .eq('pay_status', 'unpaid')
    .eq('pay_date', today)
    .not('promise_id', 'is', null);

  let charged = 0;
  let failed = 0;

  for (const payment of payments ?? []) {
    const promise = payment.promises as unknown as { toss_billing_key: string | null; customer_key: string | null };
    if (!promise?.toss_billing_key || !promise?.customer_key) continue;

    const result = await chargeBillingKey(keys.tossSecretKey, promise.toss_billing_key, {
      customerKey: promise.customer_key,
      amount: payment.amount,
      orderId: payment.idempotency_key,
      orderName: `정기후원 ${today}`,
    });

    if (result.success) {
      await supabase.from('payments').update({
        pay_status: 'paid',
        toss_payment_key: result.paymentKey,
        approved_at: new Date().toISOString(),
      }).eq('id', payment.id);
      charged++;
    } else {
      // 첫 실패: retry_count=0, next_retry_at = +1일
      const nextRetry = new Date(Date.now() + 1 * 86400000).toISOString();
      await supabase.from('payments').update({
        pay_status: 'failed',
        retry_count: 0,
        next_retry_at: nextRetry,
      }).eq('id', payment.id);

      await createBillingFailedNotification(orgId, payment.id, payment.member_id, payment.amount, result.failureMessage);
      failed++;
    }
  }

  return { charged, failed };
}
```

- [ ] **Step 2: 알림 헬퍼 작성**

`src/lib/billing/notifications.ts` (신규):

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/send-email';

export async function createBillingFailedNotification(
  orgId: string,
  paymentId: string,
  memberId: string,
  amount: number,
  failureMessage: string,
) {
  const supabase = createSupabaseAdminClient();

  // member 이름 조회
  const { data: member } = await supabase
    .from('members')
    .select('name, phone')
    .eq('id', memberId)
    .maybeSingle();

  const memberName = member?.name ?? '알 수 없음';
  const formatted = new Intl.NumberFormat('ko-KR').format(amount);

  // 인앱 알림
  await supabase.from('admin_notifications').insert({
    org_id: orgId,
    type: 'billing_failed',
    title: `자동결제 실패: ${memberName}님 ${formatted}원`,
    body: `사유: ${failureMessage}. 후원자에게 연락하여 결제수단 확인이 필요합니다.`,
    meta: { paymentId, memberId },
  });

  // 관리자 이메일 (org의 contact_email로 발송)
  const { data: org } = await supabase
    .from('orgs')
    .select('contact_email, name')
    .eq('id', orgId)
    .maybeSingle();

  if (org?.contact_email) {
    await sendEmail({
      to: org.contact_email,
      subject: `[${org.name ?? '후원'}] 자동결제 실패 알림`,
      html: `<p><strong>${memberName}</strong>님의 정기후원 ${formatted}원 자동결제가 실패했습니다.</p>
        <p>사유: ${failureMessage}</p>
        <p>연락처: ${member?.phone ?? '-'}</p>
        <p>자동 재시도가 진행됩니다. 3회 실패 시 약정이 정지됩니다.</p>`,
    });
  }
}

export async function createPledgeSuspendedNotification(
  orgId: string,
  promiseId: string,
  memberId: string,
  amount: number,
) {
  const supabase = createSupabaseAdminClient();

  const { data: member } = await supabase
    .from('members')
    .select('name, phone')
    .eq('id', memberId)
    .maybeSingle();

  const memberName = member?.name ?? '알 수 없음';
  const formatted = new Intl.NumberFormat('ko-KR').format(amount);

  await supabase.from('admin_notifications').insert({
    org_id: orgId,
    type: 'pledge_suspended',
    title: `약정 정지: ${memberName}님 ${formatted}원 정기후원`,
    body: `3회 결제 실패로 약정이 자동 정지되었습니다. 후원자에게 연락하여 결제수단 변경 또는 재활성화를 안내해 주세요.`,
    meta: { promiseId, memberId },
  });

  const { data: org } = await supabase
    .from('orgs')
    .select('contact_email, name')
    .eq('id', orgId)
    .maybeSingle();

  if (org?.contact_email) {
    await sendEmail({
      to: org.contact_email,
      subject: `[${org.name ?? '후원'}] 정기후원 약정 정지 알림`,
      html: `<p><strong>${memberName}</strong>님의 정기후원 ${formatted}원이 3회 결제 실패로 <strong>정지</strong>되었습니다.</p>
        <p>연락처: ${member?.phone ?? '-'}</p>
        <p>관리자 페이지에서 약정을 재활성화할 수 있습니다.</p>`,
    });
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/lib/billing/charge-service.ts src/lib/billing/notifications.ts
git commit -m "feat(billing): 월간 자동결제 서비스 + 알림 헬퍼"
```

---

### Task 5: 실패 재시도 서비스

**Files:**
- Create: `src/lib/billing/retry-service.ts`

- [ ] **Step 1: retry-service 작성**

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOrgTossKeys } from '@/lib/toss/keys';
import { chargeBillingKey } from './toss-billing';
import { createBillingFailedNotification, createPledgeSuspendedNotification } from './notifications';

// 재시도 간격: 1일, 3일, 7일
const RETRY_INTERVALS_MS = [
  1 * 86400000,   // retry_count 0 → 1: +1일
  3 * 86400000,   // retry_count 1 → 2: +3일
  7 * 86400000,   // retry_count 2 → 3: +7일
];

export async function processRetries(orgId: string): Promise<{ retried: number; suspended: number }> {
  const supabase = createSupabaseAdminClient();
  const keys = await getOrgTossKeys(orgId);
  if (!keys.tossSecretKey) return { retried: 0, suspended: 0 };

  const now = new Date().toISOString();

  const { data: failedPayments } = await supabase
    .from('payments')
    .select('id, amount, member_id, promise_id, retry_count, idempotency_key, promises!inner(id, toss_billing_key, customer_key, amount)')
    .eq('org_id', orgId)
    .eq('pay_status', 'failed')
    .lt('retry_count', 3)
    .lte('next_retry_at', now)
    .not('promise_id', 'is', null);

  let retried = 0;
  let suspended = 0;

  for (const payment of failedPayments ?? []) {
    const promise = payment.promises as unknown as { id: string; toss_billing_key: string | null; customer_key: string | null; amount: number };
    if (!promise?.toss_billing_key || !promise?.customer_key) continue;

    const retryOrderId = `${payment.idempotency_key}-retry${payment.retry_count + 1}`;
    const result = await chargeBillingKey(keys.tossSecretKey, promise.toss_billing_key, {
      customerKey: promise.customer_key,
      amount: payment.amount,
      orderId: retryOrderId,
      orderName: `정기후원 재시도`,
    });

    if (result.success) {
      await supabase.from('payments').update({
        pay_status: 'paid',
        toss_payment_key: result.paymentKey,
        approved_at: new Date().toISOString(),
        next_retry_at: null,
      }).eq('id', payment.id);
      retried++;
    } else {
      const newRetryCount = payment.retry_count + 1;

      if (newRetryCount >= 3) {
        // 3회 실패 → 약정 정지
        await supabase.from('payments').update({
          retry_count: newRetryCount,
          next_retry_at: null,
        }).eq('id', payment.id);

        await supabase.from('promises').update({
          status: 'suspended',
        }).eq('id', promise.id);

        await createPledgeSuspendedNotification(orgId, promise.id, payment.member_id, payment.amount);
        suspended++;
      } else {
        // 다음 재시도 예약
        const nextInterval = RETRY_INTERVALS_MS[newRetryCount] ?? 7 * 86400000;
        const nextRetry = new Date(Date.now() + nextInterval).toISOString();

        await supabase.from('payments').update({
          retry_count: newRetryCount,
          next_retry_at: nextRetry,
        }).eq('id', payment.id);

        await createBillingFailedNotification(orgId, payment.id, payment.member_id, payment.amount, result.failureMessage);
      }
    }
  }

  return { retried, suspended };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/billing/retry-service.ts
git commit -m "feat(billing): 결제 실패 재시도 서비스 — 1/3/7일 간격, 3회 후 정지"
```

---

### Task 6: promises 테이블에 customer_key 추가 + prepare API 수정

**Files:**
- Create: `supabase/migrations/20260417300003_promises_customer_key.sql`
- Modify: `src/app/api/donations/prepare/route.ts`

- [ ] **Step 1: customer_key 마이그레이션**

빌링키 자동결제 시 `customerKey`가 필요한데, 현재 `promises` 테이블에 없다. 추가:

```sql
ALTER TABLE promises ADD COLUMN IF NOT EXISTS customer_key TEXT;
COMMENT ON COLUMN promises.customer_key IS 'Toss 빌링 customerKey (자동��제용)';
```

- [ ] **Step 2: prepare API에 빌링키 발급 로직 추가**

`src/app/api/donations/prepare/route.ts` 수정:

1. body에서 카드 정보 추가 파싱:
```typescript
    cardNumber,
    cardExpirationYear,
    cardExpirationMonth,
    cardPassword,
    customerIdentityNumber,
```

2. payment INSERT 후, `donationType === 'regular'`이고 카드 정보가 모두 있으면:
   - `randomUUID()`로 customerKey 생성
   - `issueBillingKey` 호출
   - 성공 시 promise INSERT: `type: 'regular'`, `toss_billing_key`, `customer_key`, `amount`, `pay_day` (현재 일자), `status: 'active'`
   - 실패 시 promise INSERT: 빌링키 없이 `status: 'active'` (수동 처리 대상)

3. 기존 일반 결제 응답은 그대로 유지 (첫 결제는 Toss 일반 결제)

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260417300003_promises_customer_key.sql src/app/api/donations/prepare/route.ts
git commit -m "feat(billing): prepare API — 정기후원 시 빌링키 발급 + promise 생성"
```

---

### Task 7: 위저드 Step2 카드 정보 입력 (정기후원)

**Files:**
- Modify: `src/app/donate/wizard/steps/Step2.tsx`

- [ ] **Step 1: 카드 정보 입력 필드 추가**

Step2에서 `state.type === 'regular'` 일 때 카드 정보 입력 섹션을 PayMethodSelector 아래에 추가:

```tsx
{state.type === 'regular' && method === 'card' && (
  <div className="space-y-3 rounded-lg p-4" style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
    <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>정기결제 카드 정보</p>
    <Input label="카드번호 (16자리)" value={cardNumber} onChange={(v) => setCardNumber(v.replace(/\D/g, '').slice(0, 16))} />
    <div className="grid grid-cols-2 gap-2">
      <Input label="유효기간 (MM/YY)" value={cardExpiry} onChange={(v) => setCardExpiry(v)} />
      <Input label="비밀번호 앞 2자리" value={cardPassword} type="password" onChange={(v) => setCardPassword(v.replace(/\D/g, '').slice(0, 2))} />
    </div>
    <Input label="생년월일 (6자리)" value={cardBirth} onChange={(v) => setCardBirth(v.replace(/\D/g, '').slice(0, 6))} />
    <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
      매월 자동결제를 위해 카드 정보가 필요합니다. 카드 정보는 저장되지 않으며 빌링키 발급에만 사용됩니다.
    </p>
  </div>
)}
```

state 추가:
```typescript
const [cardNumber, setCardNumber] = useState('');
const [cardExpiry, setCardExpiry] = useState('');
const [cardPassword, setCardPassword] = useState('');
const [cardBirth, setCardBirth] = useState('');
```

submit에서 카드 정보를 body에 추가 (정기후원일 때만):
```typescript
...(state.type === 'regular' && method === 'card' ? {
  cardNumber,
  cardExpirationMonth: cardExpiry.split('/')[0],
  cardExpirationYear: cardExpiry.split('/')[1],
  cardPassword,
  customerIdentityNumber: cardBirth,
} : {}),
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/donate/wizard/steps/Step2.tsx
git commit -m "feat(wizard): 정기후원 카드 정보 입력 필드 추가 (테스트키 전용)"
```

---

### Task 8: cron 확장 — 자동결제 연동

**Files:**
- Modify: `src/app/api/cron/process-payments/route.ts`

- [ ] **Step 1: 자동결제 호출 추가**

기존 cron에서 payment INSERT 루프 후, `processMonthlyCharges`를 호출한다.

기존 ���드의 for 루프 끝 (`return NextResponse.json(...)` 앞)에 추가:

```typescript
  // 빌링키 자동결제 실행
  const { processMonthlyCharges } = await import('@/lib/billing/charge-service');

  // 모든 org를 처리하기 위해, 방금 생성한 payment들의 고유 org_id 추출
  const orgIds = [...new Set(promises.map(p => p.org_id as string))];
  let totalCharged = 0;
  let totalFailed = 0;

  for (const oid of orgIds) {
    const result = await processMonthlyCharges(oid);
    totalCharged += result.charged;
    totalFailed += result.failed;
  }
```

응답에 `charged`, `billingFailed` 추가:
```typescript
  return NextResponse.json({ processed, skipped, errors, charged: totalCharged, billingFailed: totalFailed });
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/cron/process-payments/route.ts
git commit -m "feat(cron): process-payments에 빌링키 자동결제 연동"
```

---

### Task 9: 재시도 Cron

**Files:**
- Create: `src/app/api/cron/retry-billing/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 재시도 cron 라우트 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { processRetries } from '@/lib/billing/retry-service';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET is required in production' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // 모든 org 조회
  const { data: orgs } = await supabase.from('orgs').select('id');

  let totalRetried = 0;
  let totalSuspended = 0;

  for (const org of orgs ?? []) {
    const result = await processRetries(org.id as string);
    totalRetried += result.retried;
    totalSuspended += result.suspended;
  }

  console.log(`[cron/retry-billing] retried=${totalRetried} suspended=${totalSuspended}`);
  return NextResponse.json({ retried: totalRetried, suspended: totalSuspended });
}
```

- [ ] **Step 2: vercel.json에 cron 추가**

```json
{
  "crons": [
    { "path": "/api/cron/process-payments", "schedule": "0 0 * * *" },
    { "path": "/api/cron/purge-expired-rrn", "schedule": "0 2 * * *" },
    { "path": "/api/cron/retry-billing", "schedule": "0 1 * * *" }
  ]
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/cron/retry-billing/route.ts vercel.json
git commit -m "feat(cron): 결제 재시도 cron — 매일 10:00 KST"
```

---

### Task 10: 관리자 알림 API

**Files:**
- Create: `src/app/api/admin/notifications/route.ts`
- Create: `src/app/api/admin/notifications/[id]/read/route.ts`
- Create: `src/app/api/admin/notifications/unread-count/route.ts`

- [ ] **Step 1: 목록 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let tenantId: string;
  try { const t = await requireTenant(); tenantId = t.id; } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('admin_notifications')
    .select('*')
    .eq('org_id', tenantId)
    .order('created_at', { ascending: false })
    .range(0, 49);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
```

- [ ] **Step 2: 읽음 처리 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  let tenantId: string;
  try { const t = await requireTenant(); tenantId = t.id; } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  await admin.from('admin_notifications').update({ read: true }).eq('id', id).eq('org_id', tenantId);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: 읽지 않은 개수 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRequestClient } from '@/lib/supabase/request-client';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function GET(req: NextRequest) {
  const supabase = createRequestClient(req);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let tenantId: string;
  try { const t = await requireTenant(); tenantId = t.id; } catch {
    return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { count } = await admin
    .from('admin_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', tenantId)
    .eq('read', false);

  return NextResponse.json({ count: count ?? 0 });
}
```

- [ ] **Step 4: 커밋**

```bash
git add src/app/api/admin/notifications/
git commit -m "feat(api): 관리자 알림 API — 목록, 읽음 처리, 미읽 개수"
```

---

### Task 11: 관리자 알림 UI (페이지 + 배지)

**Files:**
- Create: `src/components/admin/notification-badge.tsx`
- Create: `src/app/(admin)/admin/notifications/page.tsx`
- Modify: `src/components/admin/sidebar.tsx`

- [ ] **Step 1: 알림 배지 컴포넌트**

```typescript
'use client';

import { useEffect, useState } from 'react';

export function NotificationBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch('/api/admin/notifications/unread-count')
      .then(r => r.json())
      .then(d => setCount(d.count ?? 0))
      .catch(() => {});

    // 60초마다 갱신
    const interval = setInterval(() => {
      fetch('/api/admin/notifications/unread-count')
        .then(r => r.json())
        .then(d => setCount(d.count ?? 0))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (count === 0) return null;

  return (
    <span
      className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs font-bold text-white"
      style={{ background: 'var(--negative)' }}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
```

- [ ] **Step 2: 알림 페이지**

```typescript
import { requireAdminUser } from '@/lib/auth';
import { requireTenant } from '@/lib/tenant/context';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const TYPE_ICON: Record<string, string> = {
  billing_failed: '⚠️',
  pledge_suspended: '🚫',
};

function formatDate(d: string) {
  return new Date(d).toLocaleString('ko-KR');
}

export default async function NotificationsPage() {
  await requireAdminUser();
  const tenant = await requireTenant();
  const supabase = createSupabaseAdminClient();

  const { data: notifications } = await supabase
    .from('admin_notifications')
    .select('*')
    .eq('org_id', tenant.id)
    .order('created_at', { ascending: false })
    .range(0, 49);

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6" style={{ color: 'var(--text)' }}>알림</h1>
      <div className="space-y-3">
        {(notifications ?? []).length === 0 ? (
          <p className="text-center py-12" style={{ color: 'var(--muted-foreground)' }}>알림이 없습니다.</p>
        ) : (
          (notifications ?? []).map((n: Record<string, unknown>) => (
            <div
              key={n.id as string}
              className="rounded-lg border p-4"
              style={{
                borderColor: 'var(--border)',
                background: n.read ? 'var(--surface)' : 'var(--surface-2)',
                opacity: n.read ? 0.7 : 1,
              }}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{TYPE_ICON[n.type as string] ?? '🔔'}</span>
                <div className="flex-1">
                  <div className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{n.title as string}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--muted-foreground)' }}>{n.body as string}</div>
                  <div className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>{formatDate(n.created_at as string)}</div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 사이드바에 알림 링크 + 배지 ��가**

`src/components/admin/sidebar.tsx`를 읽고, 네비게이션 링크 목록에 알림 항목을 추가:

```tsx
import { NotificationBadge } from './notification-badge';

// 기존 링크 목���에 추가:
{ href: '/admin/notifications', label: '알림', badge: <NotificationBadge /> },
```

- [ ] **Step 4: 커밋**

```bash
git add src/components/admin/notification-badge.tsx src/app/(admin)/admin/notifications/page.tsx src/components/admin/sidebar.tsx
git commit -m "feat(admin): 관리자 알림 페이지 + 사이드바 배지"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 태스크 |
|------|------|
| payments retry_count, next_retry_at | Task 1 |
| admin_notifications 테이블 | Task 1 |
| Toss Billing API 래퍼 (빌링키 발급 + 자동결제) | Task 2 |
| 이메일 발송 모듈 | Task 3 |
| 월간 자동결제 서비스 | Task 4 |
| 알림 헬퍼 (인앱 + 이메일) | Task 4 |
| 실패 재시도 서비스 (1/3/7일, 약정 정지) | Task 5 |
| promises.customer_key + prepare API 빌링키 발급 | Task 6 |
| 위저드 카드 정보 입력 (정기후원) | Task 7 |
| cron 확장 (자동결제 연동) | Task 8 |
| 재시도 cron + vercel.json | Task 9 |
| 관리자 알림 API (목록, 읽음, 미읽 개수) | Task 10 |
| 관리자 알림 UI (페이지 + 배지) | Task 11 |

### 엣지 케이스 매핑
- 빌링키 발급 실패: Task 6 (promise 생성 시 빌링키 없이 처리)
- cron 중 Toss 타임아웃: Task 4 (해당 건만 failed)
- 카드 만료: Task 5 (재시도 → 정지)
- idempotency 중복: Task 8 (기존 로직 유지)
- 이메일 장애: Task 4 notifications.ts (fire-and-forget, 인앱은 항상 저장)
