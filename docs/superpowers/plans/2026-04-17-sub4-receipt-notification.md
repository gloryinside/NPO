# Sub-4: 기부금 영수증 자동발급 + 감사 알림톡 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** NHN Cloud 알림톡 4종 + 통합 알림 서비스(알림톡→SMS 폴백→이메일 병행) + 연말 영수증 일괄 자동발급 cron + 결제 예정 D-3 사전 알림 cron을 구현한다.

**Architecture:** `src/lib/notifications/` 통합 알림 레이어에서 시나리오별 발송 함수를 제공. 알림톡 실패 시 SMS 폴백, 이메일은 별도 병행. 기존 confirm/billing 코드의 이메일 호출 위치에 알림톡 통합 함수를 추가. 연말 영수증은 기존 PDF 생성 인프라를 재사용하여 cron으로 일괄 처리.

**Tech Stack:** Next.js App Router, NHN Cloud 알림톡 API v2.3, Supabase, Vercel Cron, pdfmake (기존)

---

## File Structure

### 신규 파일
| 파일 | 책임 |
|------|------|
| `src/lib/notifications/alimtalk-client.ts` | NHN Cloud 알림톡 API 래퍼 |
| `src/lib/notifications/templates.ts` | 알림톡 템플릿 코드 + SMS 폴백 메시지 |
| `src/lib/notifications/send.ts` | 시나리오별 통합 발송 (알림톡 + SMS + 이메일) |
| `src/lib/receipt/annual-batch.ts` | 연말 영수증 일괄 발급 로직 |
| `src/app/api/cron/issue-annual-receipts/route.ts` | 연말 영수증 cron |
| `src/app/api/cron/billing-reminder/route.ts` | D-3 사전 알림 cron |

### 수정 파일
| 파일 | 변경 |
|------|------|
| `src/lib/donations/confirm.ts` | notifyDonationThanks 추가 |
| `src/lib/billing/notifications.ts` | notifyBillingFailed 추가 (후원자 알림) |
| `src/app/api/admin/receipts/[memberId]/route.ts` | notifyReceiptIssued 추가 |
| `vercel.json` | 2개 cron 추가 |

---

### Task 1: NHN Cloud 알림톡 클라이언트

**Files:**
- Create: `src/lib/notifications/alimtalk-client.ts`

- [ ] **Step 1: 알림톡 클라이언트 작성**

```typescript
/**
 * NHN Cloud 알림톡 (카카오 비즈메시지) API v2.3 클라이언트.
 * 환경변수: NHN_ALIMTALK_APP_KEY, NHN_ALIMTALK_SECRET_KEY, NHN_ALIMTALK_SENDER_KEY
 */

const BASE_URL = 'https://api-alimtalk.cloud.toast.com/alimtalk/v2.3/appkeys';

type SendResult = { success: boolean; error?: string };

export async function sendAlimtalk(
  phone: string,
  templateCode: string,
  templateParameter: Record<string, string>,
): Promise<SendResult> {
  const appKey = process.env.NHN_ALIMTALK_APP_KEY;
  const secretKey = process.env.NHN_ALIMTALK_SECRET_KEY;
  const senderKey = process.env.NHN_ALIMTALK_SENDER_KEY;

  if (!appKey || !secretKey || !senderKey) {
    console.warn('[alimtalk] NHN 알림톡 환경변수 미설정 — 건너뜀');
    return { success: false, error: '알림톡 설정 누락' };
  }

  try {
    const res = await fetch(`${BASE_URL}/${appKey}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify({
        senderKey,
        templateCode,
        recipientList: [{
          recipientNo: phone,
          templateParameter,
        }],
      }),
    });

    const data = await res.json();
    if (data.header?.isSuccessful) {
      return { success: true };
    }
    console.warn('[alimtalk] 발송 실패:', data.header?.resultMessage);
    return { success: false, error: data.header?.resultMessage ?? '알림톡 발송 실패' };
  } catch (err) {
    console.error('[alimtalk] 네트워크 오류:', err);
    return { success: false, error: '알림톡 발송 중 오류' };
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/notifications/alimtalk-client.ts
git commit -m "feat(notifications): NHN Cloud 알림톡 API 클라이언트"
```

---

### Task 2: 알림톡 템플릿 + SMS 폴백 메시지

**Files:**
- Create: `src/lib/notifications/templates.ts`

- [ ] **Step 1: 템플릿 정의**

```typescript
/**
 * 알림톡 템플릿 코드 + SMS 폴백 메시지 매핑.
 * 카카오 비즈메시지 템플릿 검수 후 코드를 맞춰야 함.
 */

export const TEMPLATES = {
  DONATION_THANKS: {
    code: 'DONATION_THANKS',
    smsBody: (v: { name: string; amount: string; type: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.amount} ${v.type} 후원 감사합니다.`,
  },
  RECEIPT_ISSUED: {
    code: 'RECEIPT_ISSUED',
    smsBody: (v: { name: string; year: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.year}년 기부금 영수증이 발급되었습니다. 마이페이지에서 확인하세요.`,
  },
  BILLING_FAILED: {
    code: 'BILLING_FAILED',
    smsBody: (v: { name: string; amount: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.amount} 정기후원 결제가 실패했습니다. 결제수단을 확인해 주세요.`,
  },
  BILLING_UPCOMING: {
    code: 'BILLING_UPCOMING',
    smsBody: (v: { name: string; date: string; amount: string; orgName: string }) =>
      `[${v.orgName}] ${v.name}님, ${v.date}에 ${v.amount} 정기후원이 결제됩니다.`,
  },
} as const;
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/notifications/templates.ts
git commit -m "feat(notifications): 알림톡 4종 템플릿 + SMS 폴백 메시지 정의"
```

---

### Task 3: 통합 발송 서비스

**Files:**
- Create: `src/lib/notifications/send.ts`

- [ ] **Step 1: 통합 발송 함수 작성**

```typescript
import { sendAlimtalk } from './alimtalk-client';
import { sendSms } from '@/lib/sms/nhn-client';
import { TEMPLATES } from './templates';
import { sendDonationConfirmed, sendReceiptIssued as sendReceiptEmail } from '@/lib/email';

function fmt(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(n) + '원';
}

/**
 * 알림톡 시도 → 실패 시 SMS 폴백. fire-and-forget.
 */
async function sendWithFallback(phone: string | null, templateCode: string, params: Record<string, string>, smsBody: string): Promise<void> {
  if (!phone) return;
  const result = await sendAlimtalk(phone, templateCode, params);
  if (!result.success) {
    await sendSms(phone, smsBody);
  }
}

// ── 후원 완료 감사 ───────────────────────────────────────────────

export type DonationThanksParams = {
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

export function notifyDonationThanks(params: DonationThanksParams): void {
  const { phone, email, name, amount, type, orgName, campaignTitle, paymentCode, approvedAt } = params;
  const typeLabel = type === 'regular' ? '정기' : '일시';
  const amountStr = fmt(amount);

  // 알림톡 + SMS 폴백
  void sendWithFallback(phone, TEMPLATES.DONATION_THANKS.code, {
    name, amount: amountStr, type: typeLabel, orgName,
  }, TEMPLATES.DONATION_THANKS.smsBody({ name, amount: amountStr, type: typeLabel, orgName }));

  // 이메일 (기존 함수 재사용)
  if (email) {
    sendDonationConfirmed({ to: email, memberName: name, orgName, campaignTitle, amount, paymentCode, approvedAt });
  }
}

// ── 영수증 발급 완료 ─────────────────────────────────────────────

export type ReceiptIssuedParams = {
  phone: string | null;
  email: string | null;
  name: string;
  year: number;
  pdfUrl: string | null;
  orgName: string;
  receiptCode: string;
  totalAmount: number;
};

export function notifyReceiptIssued(params: ReceiptIssuedParams): void {
  const { phone, email, name, year, pdfUrl, orgName, receiptCode, totalAmount } = params;
  const link = pdfUrl ?? '마이페이지에서 확인';

  void sendWithFallback(phone, TEMPLATES.RECEIPT_ISSUED.code, {
    name, year: String(year), link,
  }, TEMPLATES.RECEIPT_ISSUED.smsBody({ name, year: String(year), orgName }));

  if (email) {
    sendReceiptEmail({ to: email, memberName: name, orgName, year, receiptCode, totalAmount, pdfUrl });
  }
}

// ── 결제 실패 (후원자 알림) ──────────────────────────────────────

export type BillingFailedParams = {
  phone: string | null;
  name: string;
  amount: number;
  reason: string;
  orgName: string;
};

export function notifyBillingFailed(params: BillingFailedParams): void {
  const { phone, name, amount, reason, orgName } = params;
  const amountStr = fmt(amount);

  void sendWithFallback(phone, TEMPLATES.BILLING_FAILED.code, {
    name, amount: amountStr, reason,
  }, TEMPLATES.BILLING_FAILED.smsBody({ name, amount: amountStr, orgName }));
}

// ── 결제 예정 D-3 사전 알림 ──────────────────────────────────────

export type BillingUpcomingParams = {
  phone: string | null;
  name: string;
  date: string;
  amount: number;
  orgName: string;
};

export function notifyBillingUpcoming(params: BillingUpcomingParams): void {
  const { phone, name, date, amount, orgName } = params;
  const amountStr = fmt(amount);

  void sendWithFallback(phone, TEMPLATES.BILLING_UPCOMING.code, {
    name, date, amount: amountStr,
  }, TEMPLATES.BILLING_UPCOMING.smsBody({ name, date, amount: amountStr, orgName }));
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/notifications/send.ts
git commit -m "feat(notifications): 통합 발송 서비스 — 알림톡 + SMS 폴백 + 이메일 병행"
```

---

### Task 4: 결제 확인 시 후원 감사 알림톡 연동

**Files:**
- Modify: `src/lib/donations/confirm.ts`

- [ ] **Step 1: notifyDonationThanks 호출 추가**

`src/lib/donations/confirm.ts` 수정. `sendDonationConfirmedEmail` 함수 내부에 알림톡을 추가한다.

1. 파일 상단에 import 추가:
```typescript
import { notifyDonationThanks } from '@/lib/notifications/send';
```

2. `sendDonationConfirmedEmail` 함수에서 기존 `sendDonationConfirmed(...)` 호출을 `notifyDonationThanks(...)` 로 교체:

기존 (line 211-217):
```typescript
    sendDonationConfirmed({
      to: memberEmail,
      memberName: memberRes.data?.name ?? "후원자",
      orgName: orgRes.data?.name ?? "",
      campaignTitle: campaignRes.data?.title ?? null,
      amount: Number(payment.amount),
      paymentCode: payment.payment_code,
      approvedAt: payment.approved_at,
    });
```

교체:
```typescript
    notifyDonationThanks({
      phone: memberRes.data?.phone ?? null,
      email: memberEmail,
      name: memberRes.data?.name ?? '후원자',
      amount: Number(payment.amount),
      type: 'onetime', // confirm 시점에서 type 판별은 추후 개선
      orgName: orgRes.data?.name ?? '',
      campaignTitle: campaignRes.data?.title ?? null,
      paymentCode: payment.payment_code,
      approvedAt: payment.approved_at,
    });
```

3. members select에 `phone` 추가 (line 189): `"name, email"` → `"name, email, phone"`

4. 기존 `sendDonationConfirmed` import를 제거 (더 이상 직접 호출하지 않음 — `notifyDonationThanks` 내부에서 호출):

기존:
```typescript
import { sendDonationConfirmed } from "@/lib/email";
```
제거.

- [ ] **Step 2: 커밋**

```bash
git add src/lib/donations/confirm.ts
git commit -m "feat(confirm): 후원 완료 시 notifyDonationThanks 통합 알림 연동"
```

---

### Task 5: 빌링 실패 시 후원자 알림톡 추가

**Files:**
- Modify: `src/lib/billing/notifications.ts`

- [ ] **Step 1: notifyBillingFailed 호출 추가**

`src/lib/billing/notifications.ts`의 `createBillingFailedNotification` 함수에 후원자 알림톡을 추가한다.

1. import 추가:
```typescript
import { notifyBillingFailed as notifyDonorBillingFailed } from '@/lib/notifications/send';
```

2. `createBillingFailedNotification` 함수 끝에 (이메일 발송 후) 추가:

```typescript
  // 후원자에게 알림톡
  notifyDonorBillingFailed({
    phone: member?.phone ?? null,
    name: memberName,
    amount,
    reason: failureMessage,
    orgName: org?.name ?? '후원',
  });
```

이를 위해 기존 member select에 `phone`이 이미 포함되어 있는지 확인. 현재 `'name, phone'`을 select하므로 추가 불필요.

- [ ] **Step 2: 커밋**

```bash
git add src/lib/billing/notifications.ts
git commit -m "feat(billing): 결제 실패 시 후원자 알림톡 발송 추가"
```

---

### Task 6: 영수증 발급 시 알림톡 추가

**Files:**
- Modify: `src/app/api/admin/receipts/[memberId]/route.ts`

- [ ] **Step 1: notifyReceiptIssued 호출 추가**

관리자 영수증 발급 API에서 영수증 생성 성공 후 알림톡을 추가한다.

1. import 추가:
```typescript
import { notifyReceiptIssued } from '@/lib/notifications/send';
```

2. 기존 `sendReceiptIssued(...)` 호출 위치에 `notifyReceiptIssued(...)` 로 교체:

```typescript
    notifyReceiptIssued({
      phone: member.phone ?? null,
      email: member.email ?? null,
      name: member.name,
      year,
      pdfUrl: signedUrl ?? null,
      orgName: org.name,
      receiptCode,
      totalAmount,
    });
```

3. 기존 `sendReceiptIssued` import를 제거 (통합 함수 내부에서 호출).

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/admin/receipts/[memberId]/route.ts
git commit -m "feat(receipts): 영수증 발급 시 notifyReceiptIssued 통합 알림 연동"
```

---

### Task 7: 연말 영수증 일괄 자동발급 로직

**Files:**
- Create: `src/lib/receipt/annual-batch.ts`

- [ ] **Step 1: 일괄 발급 함수 작성**

```typescript
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateReceiptCode } from '@/lib/codes';
import { generateReceiptPdf, type ReceiptData } from '@/lib/receipt/pdf';
import { notifyReceiptIssued } from '@/lib/notifications/send';

const RECEIPT_BUCKET = 'receipts';

type BatchResult = { issued: number; skipped: number; failed: number };

/**
 * 특정 org의 전년도 기부금 영수증을 일괄 자동발급.
 * receipt_opt_in=true인 paid payments를 member별 합산 → PDF 생성 → receipts INSERT → 알림.
 */
export async function issueAnnualReceipts(orgId: string, year: number): Promise<BatchResult> {
  const supabase = createSupabaseAdminClient();
  let issued = 0, skipped = 0, failed = 0;

  // 1. 대상 member별 합산 조회
  const { data: payments } = await supabase
    .from('payments')
    .select('member_id, amount')
    .eq('org_id', orgId)
    .eq('pay_status', 'paid')
    .eq('receipt_opt_in', true)
    .gte('pay_date', `${year}-01-01`)
    .lte('pay_date', `${year}-12-31`);

  if (!payments?.length) return { issued: 0, skipped: 0, failed: 0 };

  // member별 합산
  const memberTotals = new Map<string, number>();
  for (const p of payments) {
    const mid = p.member_id as string;
    memberTotals.set(mid, (memberTotals.get(mid) ?? 0) + Number(p.amount ?? 0));
  }

  // 2. 이미 해당 연도 영수증이 있는 member 조회
  const memberIds = [...memberTotals.keys()];
  const { data: existingReceipts } = await supabase
    .from('receipts')
    .select('member_id')
    .eq('org_id', orgId)
    .eq('year', year)
    .in('member_id', memberIds);

  const alreadyIssued = new Set((existingReceipts ?? []).map(r => r.member_id as string));

  // 3. org + member 정보 조회
  const { data: org } = await supabase
    .from('orgs')
    .select('name, business_no, address, contact_phone, contact_email')
    .eq('id', orgId)
    .maybeSingle();

  for (const [memberId, totalAmount] of memberTotals) {
    if (alreadyIssued.has(memberId)) {
      skipped++;
      continue;
    }

    try {
      const { data: member } = await supabase
        .from('members')
        .select('name, phone, email, birth_date')
        .eq('id', memberId)
        .maybeSingle();

      if (!member) { failed++; continue; }

      // receipt_code 생성
      const { count } = await supabase
        .from('receipts')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId);
      const seq = (count ?? 0) + 1;
      const receiptCode = generateReceiptCode(year, seq);

      // PDF 생성
      const pdfData: ReceiptData = {
        receiptCode,
        year,
        donorName: member.name,
        donorBirth: member.birth_date ?? '',
        totalAmount,
        orgName: org?.name ?? '',
        orgBusinessNo: org?.business_no ?? '',
        orgAddress: org?.address ?? '',
        orgPhone: org?.contact_phone ?? '',
        issuedDate: new Date().toISOString().slice(0, 10),
        payments: [], // 합산 영수증은 개별 내역 생략
      };
      const pdfBuffer = await generateReceiptPdf(pdfData);

      // Storage 업로드
      const filePath = `${orgId}/${year}/${memberId}.pdf`;
      await supabase.storage.from(RECEIPT_BUCKET).upload(filePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

      // Signed URL (1년)
      const { data: signedData } = await supabase.storage
        .from(RECEIPT_BUCKET)
        .createSignedUrl(filePath, 365 * 24 * 60 * 60);
      const pdfUrl = signedData?.signedUrl ?? null;

      // receipts INSERT
      await supabase.from('receipts').insert({
        org_id: orgId,
        receipt_code: receiptCode,
        member_id: memberId,
        year,
        total_amount: totalAmount,
        pdf_url: pdfUrl,
        issued_at: new Date().toISOString(),
        issued_by: 'system-annual-batch',
      });

      // 알림 발송
      notifyReceiptIssued({
        phone: member.phone ?? null,
        email: member.email ?? null,
        name: member.name,
        year,
        pdfUrl,
        orgName: org?.name ?? '',
        receiptCode,
        totalAmount,
      });

      issued++;
    } catch (err) {
      console.error(`[annual-receipt] member ${memberId} 실패:`, err);
      failed++;
    }
  }

  return { issued, skipped, failed };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/receipt/annual-batch.ts
git commit -m "feat(receipt): 연말 영수증 일괄 자동발급 로직"
```

---

### Task 8: 연말 영수증 Cron

**Files:**
- Create: `src/app/api/cron/issue-annual-receipts/route.ts`

- [ ] **Step 1: cron 라우트 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { issueAnnualReceipts } from '@/lib/receipt/annual-batch';

/**
 * GET /api/cron/issue-annual-receipts
 * 매년 1월 5일 09:00 KST — 전년도 기부금 영수증 일괄 자동발급.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET required' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: orgs } = await supabase.from('orgs').select('id');

  // 전년도
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const previousYear = nowKst.getUTCFullYear() - 1;

  let totalIssued = 0, totalSkipped = 0, totalFailed = 0;

  for (const org of orgs ?? []) {
    const result = await issueAnnualReceipts(org.id as string, previousYear);
    totalIssued += result.issued;
    totalSkipped += result.skipped;
    totalFailed += result.failed;
  }

  console.log(`[cron/issue-annual-receipts] year=${previousYear} issued=${totalIssued} skipped=${totalSkipped} failed=${totalFailed}`);
  return NextResponse.json({ year: previousYear, issued: totalIssued, skipped: totalSkipped, failed: totalFailed });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/cron/issue-annual-receipts/route.ts
git commit -m "feat(cron): 연말 영수증 일괄 자동발급 cron — 매년 1월 5일"
```

---

### Task 9: 결제 예정 D-3 사전 알림 Cron + vercel.json

**Files:**
- Create: `src/app/api/cron/billing-reminder/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: 사전 알림 cron 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { notifyBillingUpcoming } from '@/lib/notifications/send';

/**
 * GET /api/cron/billing-reminder
 * 매일 09:30 KST — 3일 후 결제 예정인 정기후원자에게 사전 알림.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const header = req.headers.get('x-cron-secret') ?? '';
    if (header !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET required' }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();

  // KST 기준 3일 후 day 계산
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const threeDaysLater = new Date(nowKst.getTime() + 3 * 86400000);
  const targetDay = threeDaysLater.getUTCDate();
  const targetDateStr = threeDaysLater.toISOString().slice(0, 10);

  // active 정기 약정 중 pay_day가 3일 후인 것 조회
  const { data: promises } = await supabase
    .from('promises')
    .select('id, org_id, member_id, amount, members!inner(name, phone), orgs!inner(name)')
    .eq('status', 'active')
    .eq('type', 'regular')
    .eq('pay_day', targetDay);

  let sent = 0;

  for (const promise of promises ?? []) {
    const member = promise.members as unknown as { name: string; phone: string | null };
    const org = promise.orgs as unknown as { name: string };

    notifyBillingUpcoming({
      phone: member?.phone ?? null,
      name: member?.name ?? '후원자',
      date: targetDateStr,
      amount: promise.amount as number,
      orgName: org?.name ?? '',
    });
    sent++;
  }

  console.log(`[cron/billing-reminder] targetDay=${targetDay} sent=${sent}`);
  return NextResponse.json({ targetDay, sent });
}
```

- [ ] **Step 2: vercel.json에 2개 cron 추가**

현재 vercel.json:
```json
{
  "crons": [
    { "path": "/api/cron/process-payments", "schedule": "0 0 * * *" },
    { "path": "/api/cron/purge-expired-rrn", "schedule": "0 2 * * *" },
    { "path": "/api/cron/retry-billing", "schedule": "0 1 * * *" }
  ]
}
```

추가:
```json
    { "path": "/api/cron/billing-reminder", "schedule": "30 0 * * *" },
    { "path": "/api/cron/issue-annual-receipts", "schedule": "0 0 5 1 *" }
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/cron/billing-reminder/route.ts vercel.json
git commit -m "feat(cron): D-3 결제 예정 사전 알림 + 연말 영수증 cron 스케줄 추가"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 태스크 |
|------|------|
| NHN Cloud 알림톡 API 클라이언트 | Task 1 |
| 알림톡 4종 템플릿 + SMS 폴백 | Task 2 |
| 통합 발송 서비스 (알림톡→SMS→이메일) | Task 3 |
| 결제 확인 시 후원 감사 알림톡 | Task 4 |
| 빌링 실패 시 후원자 알림톡 | Task 5 |
| 영수증 발급 시 알림톡 | Task 6 |
| 연말 영수증 일괄 자동발급 로직 | Task 7 |
| 연말 영수증 cron (1월 5일) | Task 8 |
| 결제 예정 D-3 사전 알림 cron | Task 9 |
| vercel.json cron 추가 | Task 9 |

### 엣지 케이스 매핑
- 알림톡 실패 → SMS 폴백: Task 3 `sendWithFallback`
- 전화번호 없음: Task 3 `if (!phone) return`
- 이미 발급된 연도 영수증: Task 7 `alreadyIssued` Set
- PDF 생성 실패: Task 7 try/catch per member
- NHN 알림톡 환경변수 미설정: Task 1 early return with warning
