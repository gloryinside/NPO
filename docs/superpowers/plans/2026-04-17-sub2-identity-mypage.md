# Sub-2: 본인인증 + 비회원 마이페이지 통합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 비회원도 SMS OTP로 마이페이지에 접근하고, 토스 본인인증으로 기부금 영수증 실명 확인을 지원하며, 후원 취소/해지 셀프서비스를 제공한다.

**Architecture:** SMS OTP 인증 → JWT 세션 쿠키 → 기존 `getDonorSession()` 확장으로 통합 인증. 토스 본인인증은 위저드 Step2에서 영수증 신청 시에만 호출. 마이페이지는 기존 `/donor` 경로를 확장하여 회원/비회원 모두 지원.

**Tech Stack:** Next.js App Router, Supabase, Zod, jose (JWT), NHN Cloud Notification SMS API, Toss Identity Verification API

---

## File Structure

### 신규 파일
| 파일 | 책임 |
|------|------|
| `supabase/migrations/YYYYMMDD_otp_codes.sql` | otp_codes 테이블 생성 |
| `supabase/migrations/YYYYMMDD_members_identity.sql` | members에 ci_hash, identity_verified_at 추가 |
| `src/lib/sms/nhn-client.ts` | NHN Cloud SMS 발송 모듈 |
| `src/lib/auth/otp-session.ts` | OTP JWT 서명/검증/쿠키 유틸 |
| `src/app/api/auth/otp/send/route.ts` | OTP 발송 API |
| `src/app/api/auth/otp/verify/route.ts` | OTP 검증 + 세션 발급 API |
| `src/app/api/auth/identity/request/route.ts` | 토스 본인인증 요청 API |
| `src/app/api/auth/identity/confirm/route.ts` | 토스 본인인증 확인 API |
| `src/app/api/donor/payments/[id]/cancel/route.ts` | 일시후원 취소 API |
| `src/app/api/donor/pledges/[id]/cancel/route.ts` | 정기후원 해지 API |
| `src/components/donor/otp-login-form.tsx` | OTP 간편 로그인 폼 |
| `src/components/donor/cancel-confirm-modal.tsx` | 취소/해지 확인 모달 |

### 수정 파일
| 파일 | 변경 내용 |
|------|------|
| `src/lib/auth.ts` | `getDonorSession()` 확장 — OTP JWT 세션 지원 |
| `src/types/member.ts` | `ci_hash`, `identity_verified_at` 필드 추가 |
| `src/app/(donor)/donor/login/page.tsx` | OTP 로그인 섹션 추가 |
| `src/app/donate/wizard/steps/Step2.tsx` | 본인인증 UI 추가, 주민번호 입력 제거 |
| `src/app/(donor)/donor/payments/page.tsx` | 취소 버튼 추가 |
| `src/app/(donor)/donor/page.tsx` | 취소/해지 UI, 비회원 분기 |

---

### Task 1: otp_codes 마이그레이션

**Files:**
- Create: `supabase/migrations/20260417200001_otp_codes.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- OTP 인증 코드 저장
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_codes_phone_org ON otp_codes(phone, org_id);
CREATE INDEX idx_otp_codes_expires ON otp_codes(expires_at);

-- RLS: service-role only
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE otp_codes IS 'SMS OTP 인증 코드. 5분 TTL, rate limit 관리용.';
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/migrations/20260417200001_otp_codes.sql
git commit -m "feat(db): otp_codes 테이블 생성 마이그레이션"
```

---

### Task 2: members 본인인증 컬럼 마이그레이션

**Files:**
- Create: `supabase/migrations/20260417200002_members_identity.sql`
- Modify: `src/types/member.ts`

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- 본인인증 정보 컬럼 추가
ALTER TABLE members ADD COLUMN IF NOT EXISTS ci_hash TEXT;
ALTER TABLE members ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ;

COMMENT ON COLUMN members.ci_hash IS '토스 본인인증 CI 해시값';
COMMENT ON COLUMN members.identity_verified_at IS '본인인증 완료 시각';
```

- [ ] **Step 2: Member 타입에 필드 추가**

`src/types/member.ts`의 `Member` 타입에 추가:

```typescript
  ci_hash?: string | null;
  identity_verified_at?: string | null;
```

`id_number_encrypted` 위에 추가한다.

- [ ] **Step 3: 커밋**

```bash
git add supabase/migrations/20260417200002_members_identity.sql src/types/member.ts
git commit -m "feat(db): members 테이블에 ci_hash, identity_verified_at 추가"
```

---

### Task 3: NHN Cloud SMS 클라이언트

**Files:**
- Create: `src/lib/sms/nhn-client.ts`

- [ ] **Step 1: SMS 발송 모듈 작성**

```typescript
/**
 * NHN Cloud Notification SMS API v3.0 클라이언트.
 * 환경변수: NHN_SMS_APP_KEY, NHN_SMS_SECRET_KEY, NHN_SMS_SENDER
 */

const BASE_URL = 'https://api-sms.cloud.toast.com/sms/v3.0/appKeys';

type SendResult = { success: boolean; error?: string };

export async function sendSms(phone: string, body: string): Promise<SendResult> {
  const appKey = process.env.NHN_SMS_APP_KEY;
  const secretKey = process.env.NHN_SMS_SECRET_KEY;
  const sender = process.env.NHN_SMS_SENDER;

  if (!appKey || !secretKey || !sender) {
    console.error('[SMS] NHN Cloud 환경변수 미설정');
    return { success: false, error: 'SMS 서비스 설정이 누락되었습니다.' };
  }

  try {
    const res = await fetch(`${BASE_URL}/${appKey}/sender/sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'X-Secret-Key': secretKey,
      },
      body: JSON.stringify({
        body,
        sendNo: sender,
        recipientList: [{ recipientNo: phone }],
      }),
    });

    const data = await res.json();
    if (data.header?.isSuccessful) {
      return { success: true };
    }
    console.error('[SMS] 발송 실패:', data.header?.resultMessage);
    return { success: false, error: data.header?.resultMessage ?? 'SMS 발송 실패' };
  } catch (err) {
    console.error('[SMS] 네트워크 오류:', err);
    return { success: false, error: 'SMS 발송 중 오류가 발생했습니다.' };
  }
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/sms/nhn-client.ts
git commit -m "feat(sms): NHN Cloud SMS 발송 클라이언트 추가"
```

---

### Task 4: OTP JWT 세션 유틸

**Files:**
- Create: `src/lib/auth/otp-session.ts`

- [ ] **Step 1: JWT 세션 모듈 작성**

`jose` 패키지가 없으면 설치: `npm install jose`

```typescript
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'donor-otp-session';
const MAX_AGE = 86400; // 24시간

export type OtpPayload = {
  memberId: string;
  orgId: string;
  phone: string;
};

function getSecret() {
  const secret = process.env.OTP_JWT_SECRET;
  if (!secret) throw new Error('OTP_JWT_SECRET 환경변수 미설정');
  return new TextEncoder().encode(secret);
}

export async function signOtpToken(payload: OtpPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime(`${MAX_AGE}s`)
    .setIssuedAt()
    .sign(getSecret());
}

export async function verifyOtpToken(token: string): Promise<OtpPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as OtpPayload;
  } catch {
    return null;
  }
}

export async function getOtpSessionFromCookies(): Promise<OtpPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyOtpToken(token);
}

export function otpSessionCookieConfig(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: MAX_AGE,
    path: '/',
  };
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/lib/auth/otp-session.ts
git commit -m "feat(auth): OTP JWT 세션 서명/검증 유틸 추가"
```

---

### Task 5: getDonorSession() OTP 세션 통합

**Files:**
- Modify: `src/lib/auth.ts`

- [ ] **Step 1: getDonorSession 확장**

`src/lib/auth.ts`의 `getDonorSession()` 함수를 수정한다.

기존 Supabase Auth 세션 확인 후, 실패 시 OTP JWT 쿠키를 확인하는 폴백을 추가한다.

`DonorSession` 타입을 수정하여 `user`를 optional로:

```typescript
import { getOtpSessionFromCookies } from '@/lib/auth/otp-session';

export type DonorSession = {
  user: User | null;      // Supabase Auth 유저 (OTP 세션에서는 null)
  member: Member;
  authMethod: 'supabase' | 'otp';
};
```

`getDonorSession()` 함수 교체:

```typescript
export async function getDonorSession(): Promise<DonorSession | null> {
  const tenant = await getTenant();
  if (!tenant) return null;

  // 1. Supabase Auth 세션 시도
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    const admin = createSupabaseAdminClient();
    const { data: member } = await admin
      .from('members')
      .select('*')
      .eq('supabase_uid', user.id)
      .eq('org_id', tenant.id)
      .maybeSingle();

    if (member) {
      return { user, member: member as Member, authMethod: 'supabase' };
    }
  }

  // 2. OTP JWT 세션 폴백
  const otpPayload = await getOtpSessionFromCookies();
  if (otpPayload && otpPayload.orgId === tenant.id) {
    const admin = createSupabaseAdminClient();
    const { data: member } = await admin
      .from('members')
      .select('*')
      .eq('id', otpPayload.memberId)
      .eq('org_id', tenant.id)
      .maybeSingle();

    if (member) {
      return { user: null, member: member as Member, authMethod: 'otp' };
    }
  }

  return null;
}
```

- [ ] **Step 2: requireDonorSession과 사용처 호환성 확인**

`requireDonorSession()`은 그대로 동작한다 (session.member에만 의존).

기존 사용처에서 `session.user`에 접근하는 곳이 있다면 `session.user?.id` 등으로 safe access가 필요하지만, 현재 코드베이스를 확인한 결과 `session.user`를 직접 사용하는 곳은 없다 (`session.member`만 사용).

- [ ] **Step 3: 커밋**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): getDonorSession에 OTP JWT 세션 폴백 통합"
```

---

### Task 6: OTP 발송 API

**Files:**
- Create: `src/app/api/auth/otp/send/route.ts`

- [ ] **Step 1: API 라우트 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTenant } from '@/lib/tenant/context';
import { sendSms } from '@/lib/sms/nhn-client';

const BodySchema = z.object({
  phone: z.string().regex(/^01[016789]\d{7,8}$/, '올바른 휴대폰 번호를 입력하세요.'),
});

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? '잘못된 요청' }, { status: 400 });
  }

  const { phone } = parsed.data;
  const supabase = createSupabaseAdminClient();

  // Rate limit: 1분 내 기존 코드 확인
  const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
  const { data: recent } = await supabase
    .from('otp_codes')
    .select('id')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .gte('created_at', oneMinAgo)
    .limit(1);

  if (recent && recent.length > 0) {
    return NextResponse.json({ error: '잠시 후 다시 시도해 주세요.' }, { status: 429 });
  }

  // 6자리 코드 생성
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 900000 + 100000);
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();

  await supabase.from('otp_codes').insert({
    org_id: tenant.id,
    phone,
    code,
    expires_at: expiresAt,
  });

  // SMS 발송
  const orgName = tenant.name ?? '후원';
  const result = await sendSms(phone, `[${orgName}] 인증번호: ${code} (5분 이내 입력)`);

  if (!result.success) {
    return NextResponse.json({ error: 'SMS 발송에 실패했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/auth/otp/send/route.ts
git commit -m "feat(api): OTP 발송 API — rate limit + NHN SMS 연동"
```

---

### Task 7: OTP 검증 + 세션 발급 API

**Files:**
- Create: `src/app/api/auth/otp/verify/route.ts`

- [ ] **Step 1: API 라우트 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getTenant } from '@/lib/tenant/context';
import { signOtpToken, otpSessionCookieConfig } from '@/lib/auth/otp-session';

const BodySchema = z.object({
  phone: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: NextRequest) {
  const tenant = await getTenant();
  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 400 });

  const body = await req.json();
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { phone, code } = parsed.data;
  const supabase = createSupabaseAdminClient();

  // 30분 잠금 확인: 최근 5건의 attempts 합산
  const thirtyMinAgo = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: recentAttempts } = await supabase
    .from('otp_codes')
    .select('attempts')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .gte('created_at', thirtyMinAgo)
    .order('created_at', { ascending: false })
    .limit(5);

  const totalAttempts = (recentAttempts ?? []).reduce(
    (sum: number, r: { attempts: number }) => sum + r.attempts, 0
  );
  if (totalAttempts >= 5) {
    return NextResponse.json({ error: '인증 시도 횟수를 초과했습니다. 30분 후 다시 시도해 주세요.' }, { status: 429 });
  }

  // 최신 미인증 코드 조회
  const now = new Date().toISOString();
  const { data: otpRow } = await supabase
    .from('otp_codes')
    .select('*')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .eq('verified', false)
    .gte('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!otpRow) {
    return NextResponse.json({ error: '인증번호가 만료되었습니다. 다시 발송해 주세요.' }, { status: 400 });
  }

  // 코드 검증
  if (otpRow.code !== code) {
    await supabase
      .from('otp_codes')
      .update({ attempts: (otpRow.attempts ?? 0) + 1 })
      .eq('id', otpRow.id);
    return NextResponse.json({ error: '인증번호가 일치하지 않습니다.' }, { status: 400 });
  }

  // 인증 성공
  await supabase.from('otp_codes').update({ verified: true }).eq('id', otpRow.id);

  // members 매칭
  const { data: member } = await supabase
    .from('members')
    .select('id')
    .eq('phone', phone)
    .eq('org_id', tenant.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!member) {
    return NextResponse.json({ ok: false, reason: 'no_member' });
  }

  // JWT 세션 발급
  const token = await signOtpToken({ memberId: member.id, orgId: tenant.id, phone });
  const cookie = otpSessionCookieConfig(token);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookie);
  return res;
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/auth/otp/verify/route.ts
git commit -m "feat(api): OTP 검증 + JWT 세션 발급 API"
```

---

### Task 8: OTP 간편 로그인 폼 + 로그인 페이지 수정

**Files:**
- Create: `src/components/donor/otp-login-form.tsx`
- Modify: `src/app/(donor)/donor/login/page.tsx`
- Modify: `src/components/donor/login-form.tsx`

- [ ] **Step 1: OTP 로그인 폼 작성**

```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Phase = 'phone' | 'code';

export function OtpLoginForm() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/send', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/-/g, '') }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? '발송 실패');
        return;
      }
      setPhase('code');
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.replace(/-/g, ''), code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? '인증 실패');
        return;
      }
      if (!data.ok && data.reason === 'no_member') {
        setError('해당 번호로 등록된 후원 내역이 없습니다.');
        return;
      }
      router.push('/donor');
      router.refresh();
    } catch {
      setError('오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      {phase === 'phone' ? (
        <>
          <input
            type="tel"
            placeholder="010-1234-5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            onClick={handleSendOtp}
            disabled={loading || phone.replace(/-/g, '').length < 10}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '발송 중…' : '인증번호 발송'}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
            {phone}으로 발송된 인증번호를 입력하세요.
          </p>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="인증번호 6자리"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className="w-full rounded-lg border px-3 py-2 text-sm text-center tracking-widest outline-none"
            style={{
              background: 'var(--surface-2)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          />
          <button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--accent)' }}
          >
            {loading ? '확인 중…' : '로그인'}
          </button>
          <button
            onClick={() => { setPhase('phone'); setCode(''); setError(null); }}
            className="w-full text-sm"
            style={{ color: 'var(--muted-foreground)' }}
          >
            번호 다시 입력
          </button>
        </>
      )}
      {error && <p className="text-sm" style={{ color: 'var(--negative)' }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: 로그인 폼에 OTP 섹션 추가**

`src/components/donor/login-form.tsx`의 닫는 `</div>` (line 110 부근, "아직 계정이 없으신가요?" 단락의 부모 div) 앞에 구분선과 OTP 폼 임포트를 추가한다.

로그인 폼 파일의 맨 위에 import 추가:
```typescript
import { OtpLoginForm } from '@/components/donor/otp-login-form';
```

"아직 계정이 없으신가요?" `<p>` 태그 앞에 삽입:
```tsx
        <div className="my-5 flex items-center gap-3">
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>또는</span>
          <hr className="flex-1" style={{ borderColor: 'var(--border)' }} />
        </div>

        <p className="mb-3 text-center text-sm font-medium" style={{ color: 'var(--text)' }}>
          휴대폰 번호로 간편 로그인
        </p>
        <OtpLoginForm />
```

- [ ] **Step 3: 로그인 페이지의 getDonorSession 확인**

`src/app/(donor)/donor/login/page.tsx`는 이미 `getDonorSession()`을 사용하므로 OTP 세션도 자동으로 감지한다. 변경 불필요.

- [ ] **Step 4: 커밋**

```bash
git add src/components/donor/otp-login-form.tsx src/components/donor/login-form.tsx
git commit -m "feat(donor): OTP 간편 로그인 폼 + 로그인 페이지에 통합"
```

---

### Task 9: 토스 본인인증 API

**Files:**
- Create: `src/app/api/auth/identity/request/route.ts`
- Create: `src/app/api/auth/identity/confirm/route.ts`

- [ ] **Step 1: 인증 요청 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const secretKey = process.env.TOSS_IDENTITY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: '본인인증 설정이 누락되었습니다.' }, { status: 500 });
  }

  const { successUrl, failUrl } = await req.json();

  const res = await fetch('https://api.tosspayments.com/v1/identity-verification/requests', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requestedAt: new Date().toISOString(),
      successUrl,
      failUrl,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: '본인인증 요청 실패', details: err }, { status: res.status });
  }

  const data = await res.json();
  return NextResponse.json({ txId: data.txId });
}
```

- [ ] **Step 2: 인증 확인 API**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  const secretKey = process.env.TOSS_IDENTITY_SECRET_KEY;
  if (!secretKey) {
    return NextResponse.json({ error: '본인인증 설정이 누락되었습니다.' }, { status: 500 });
  }

  const { txId, memberId } = await req.json();
  if (!txId) {
    return NextResponse.json({ error: 'txId가 필요합니다.' }, { status: 400 });
  }

  // 토스 API로 인증 결과 조회
  const res = await fetch(`https://api.tosspayments.com/v1/identity-verification/requests/${txId}`, {
    headers: {
      'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: '본인인증 확인 실패', details: err }, { status: res.status });
  }

  const data = await res.json();
  const { name, birthday, ci } = data.personalInfo ?? {};

  if (!ci) {
    return NextResponse.json({ error: '본인인증 정보를 가져올 수 없습니다.' }, { status: 400 });
  }

  // members 업데이트 (memberId가 있으면)
  if (memberId) {
    const supabase = createSupabaseAdminClient();
    await supabase
      .from('members')
      .update({
        ci_hash: ci,
        identity_verified_at: new Date().toISOString(),
        name: name ?? undefined,
        birth_date: birthday ?? undefined,
      })
      .eq('id', memberId);
  }

  return NextResponse.json({ ok: true, name, birthday });
}
```

- [ ] **Step 3: 커밋**

```bash
git add src/app/api/auth/identity/request/route.ts src/app/api/auth/identity/confirm/route.ts
git commit -m "feat(api): 토스 본인인증 요청/확인 API 추가"
```

---

### Task 10: 위저드 Step2 본인인증 UI

**Files:**
- Modify: `src/app/donate/wizard/steps/Step2.tsx`

- [ ] **Step 1: 본인인증 UI 추가**

Step2에서 영수증 체크박스 영역을 수정한다:

1. 기존 주민번호 입력(`residentNo` state + Input)을 제거
2. 대신 본인인증 상태 관리 추가:

```typescript
const [identityVerified, setIdentityVerified] = useState(false);
const [identityName, setIdentityName] = useState('');
```

3. 영수증 체크박스 아래에 본인인증 섹션 추가:

```tsx
{receipt && !identityVerified && (
  <button
    type="button"
    onClick={async () => {
      const res = await fetch('/api/auth/identity/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          successUrl: `${window.location.origin}/donate/wizard?identity=success`,
          failUrl: `${window.location.origin}/donate/wizard?identity=fail`,
        }),
      });
      if (!res.ok) return alert('본인인증 요청 실패');
      const { txId } = await res.json();
      // 토스 본인인증 팝업 — txId를 sessionStorage에 저장
      sessionStorage.setItem('identity_txId', txId);
      window.open(`https://auth.tosspayments.com/v1/identity-verification/${txId}`, '_blank', 'width=500,height=700');
    }}
    className="w-full rounded-lg py-2.5 text-sm font-semibold"
    style={{ background: 'var(--surface-2)', border: '1px solid var(--accent)', color: 'var(--accent)' }}
  >
    본인인증
  </button>
)}
{receipt && identityVerified && (
  <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
    style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}>
    <span>✓</span> 본인인증 완료 ({identityName})
  </div>
)}
```

4. `submit()` 함수에서 `residentNo` 전송 부분을 `identityVerified`로 교체 — 영수증 신청 시 주민번호 대신 본인인증 완료 여부만 전송.

- [ ] **Step 2: 커밋**

```bash
git add src/app/donate/wizard/steps/Step2.tsx
git commit -m "feat(wizard): Step2에 토스 본인인증 UI 추가, 주민번호 입력 제거"
```

---

### Task 11: 취소 확인 모달

**Files:**
- Create: `src/components/donor/cancel-confirm-modal.tsx`

- [ ] **Step 1: 모달 컴포넌트 작성**

```typescript
'use client';

import { useState } from 'react';

interface CancelConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function CancelConfirmModal({ title, message, confirmLabel, onConfirm, onClose }: CancelConfirmModalProps) {
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="mx-4 w-full max-w-sm rounded-xl p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--text)' }}>{title}</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--muted-foreground)' }}>{message}</p>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-lg py-2.5 text-sm"
            style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', color: 'var(--text)' }}
          >
            취소
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 rounded-lg py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--negative)' }}
          >
            {loading ? '처리 중…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/components/donor/cancel-confirm-modal.tsx
git commit -m "feat(donor): 취소/해지 확인 모달 컴포넌트 추가"
```

---

### Task 12: 일시후원 취소 API

**Files:**
- Create: `src/app/api/donor/payments/[id]/cancel/route.ts`

- [ ] **Step 1: 취소 API 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  // payment 조회 + 소유권 확인
  const { data: payment } = await supabase
    .from('payments')
    .select('id, pay_status, pay_date, amount, toss_payment_key, org_id, member_id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle();

  if (!payment) return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다.' }, { status: 404 });
  if (payment.pay_status !== 'paid') return NextResponse.json({ error: '취소 가능한 상태가 아닙니다.' }, { status: 400 });

  // 7일 이내 확인
  const payDate = new Date(payment.pay_date);
  const daysSince = (Date.now() - payDate.getTime()) / 86400000;
  if (daysSince > 7) {
    return NextResponse.json({ error: '취소 가능 기간(7일)이 지났습니다. 관리자에게 문의해 주세요.' }, { status: 400 });
  }

  // 토스 결제 취소 API 호출
  if (payment.toss_payment_key) {
    const { data: secrets } = await supabase
      .from('org_secrets')
      .select('toss_secret_key_enc')
      .eq('org_id', payment.org_id)
      .maybeSingle();

    if (secrets?.toss_secret_key_enc) {
      const { decryptSecret } = await import('@/lib/secrets/crypto');
      const secretKey = await decryptSecret(secrets.toss_secret_key_enc);
      if (secretKey) {
        const tossRes = await fetch(`https://api.tosspayments.com/v1/payments/${payment.toss_payment_key}/cancel`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(secretKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ cancelReason: '후원자 요청 취소' }),
        });
        if (!tossRes.ok) {
          const err = await tossRes.json().catch(() => ({}));
          return NextResponse.json({ error: '결제 취소 실패', details: err }, { status: 500 });
        }
      }
    }
  }

  // DB 상태 업데이트
  await supabase
    .from('payments')
    .update({ pay_status: 'cancelled', cancelled_at: new Date().toISOString() })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/donor/payments/[id]/cancel/route.ts
git commit -m "feat(api): 일시후원 취소 API — 토스 결제 취소 연동"
```

---

### Task 13: 정기후원 해지 API

**Files:**
- Create: `src/app/api/donor/pledges/[id]/cancel/route.ts`

- [ ] **Step 1: 해지 API 작성**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getDonorSession } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getDonorSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const supabase = createSupabaseAdminClient();

  const { data: pledge } = await supabase
    .from('promises')
    .select('id, status, member_id, org_id')
    .eq('id', id)
    .eq('member_id', session.member.id)
    .eq('org_id', session.member.org_id)
    .maybeSingle();

  if (!pledge) return NextResponse.json({ error: '약정 정보를 찾을 수 없습니다.' }, { status: 404 });
  if (pledge.status !== 'active') return NextResponse.json({ error: '해지 가능한 상태가 아닙니다.' }, { status: 400 });

  await supabase
    .from('promises')
    .update({ status: 'cancelled' })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: 커밋**

```bash
git add src/app/api/donor/pledges/[id]/cancel/route.ts
git commit -m "feat(api): 정기후원 해지 API — promise status cancelled"
```

---

### Task 14: 납입 내역 페이지에 취소 버튼 추가

**Files:**
- Modify: `src/app/(donor)/donor/payments/page.tsx`

- [ ] **Step 1: 취소 버튼 클라이언트 컴포넌트 추가**

페이지가 서버 컴포넌트이므로, 취소 버튼을 위한 클라이언트 래퍼가 필요하다.

페이지 파일 상단에 인라인 클라이언트 컴포넌트를 추가하지 않고, 별도 파일을 만든다:

`src/components/donor/payment-cancel-button.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CancelConfirmModal } from './cancel-confirm-modal';

export function PaymentCancelButton({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  async function handleCancel() {
    const res = await fetch(`/api/donor/payments/${paymentId}/cancel`, { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '취소 실패');
      return;
    }
    setShowModal(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs px-2 py-1 rounded"
        style={{ color: 'var(--negative)', border: '1px solid var(--negative)' }}
      >
        취소
      </button>
      {showModal && (
        <CancelConfirmModal
          title="후원 취소"
          message="이 결제를 취소하시겠습니까? 이 작업은 되돌릴 수 없습니다."
          confirmLabel="취소하기"
          onConfirm={handleCancel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: 납입 내역 테이블에 취소 버튼 열 추가**

`src/app/(donor)/donor/payments/page.tsx`에서:

1. import 추가: `import { PaymentCancelButton } from '@/components/donor/payment-cancel-button';`

2. `<TableHeader>`에 "관리" 열 추가:
```tsx
<TableHead style={{ color: "var(--muted-foreground)" }}>관리</TableHead>
```

3. 각 `<TableRow>`에 취소 버튼 셀 추가 (영수증 `<TableCell>` 뒤):
```tsx
<TableCell>
  {p.pay_status === 'paid' && (() => {
    const daysSince = (Date.now() - new Date(p.pay_date).getTime()) / 86400000;
    return daysSince <= 7 ? <PaymentCancelButton paymentId={p.id} /> : null;
  })()}
</TableCell>
```

4. 빈 행의 `colSpan`을 5→6으로 변경

- [ ] **Step 3: 커밋**

```bash
git add src/components/donor/payment-cancel-button.tsx src/app/(donor)/donor/payments/page.tsx
git commit -m "feat(donor): 납입 내역에 취소 버튼 추가 (7일 이내)"
```

---

### Task 15: 마이페이지 대시보드에 해지 + 비회원 분기

**Files:**
- Modify: `src/app/(donor)/donor/page.tsx`

- [ ] **Step 1: 해지 버튼 클라이언트 컴포넌트**

`src/components/donor/pledge-cancel-button.tsx`:
```typescript
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CancelConfirmModal } from './cancel-confirm-modal';

export function PledgeCancelButton({ pledgeId }: { pledgeId: string }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);

  async function handleCancel() {
    const res = await fetch(`/api/donor/pledges/${pledgeId}/cancel`, { method: 'PATCH' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? '해지 실패');
      return;
    }
    setShowModal(false);
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="text-xs px-2 py-1 rounded"
        style={{ color: 'var(--negative)', border: '1px solid var(--negative)' }}
      >
        해지
      </button>
      {showModal && (
        <CancelConfirmModal
          title="정기후원 해지"
          message="정기후원을 해지하시겠습니까? 다음 회차부터 자동결제가 중단됩니다."
          confirmLabel="해지하기"
          onConfirm={handleCancel}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: 대시보드 수정**

`src/app/(donor)/donor/page.tsx`에서:

1. `requireDonorSession()` → `getDonorSession()` + redirect 분기로 변경 (authMethod 접근을 위해):

```typescript
import { getDonorSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { PledgeCancelButton } from '@/components/donor/pledge-cancel-button';
import { PaymentCancelButton } from '@/components/donor/payment-cancel-button';

// ...

export default async function DonorHomePage() {
  const session = await getDonorSession();
  if (!session) redirect('/donor/login');

  const { member, authMethod } = session;
  // ... rest of data fetching stays the same
```

2. 활성 약정 섹션에 해지 버튼:

약정 링크 "내 약정 보기 →" 아래에 약정 목록 + 해지 버튼을 표시. 현재 약정 목록은 `activePromises`에 있으므로, 각 항목에 `PledgeCancelButton`을 추가한다.

3. DonorProfileSection 아래에서 비회원 분기: `authMethod === 'otp'`이면 비밀번호/이메일 변경 버튼을 렌더링하지 않음. (현재 DonorProfileSection이 이 기능을 포함하는지 확인 필요 — 포함하지 않으면 변경 불필요.)

- [ ] **Step 3: 커밋**

```bash
git add src/components/donor/pledge-cancel-button.tsx src/app/(donor)/donor/page.tsx
git commit -m "feat(donor): 마이페이지 대시보드에 약정 해지 + 비회원 분기"
```

---

## Self-Review

### Spec Coverage

| 스펙 요구사항 | 태스크 |
|------|------|
| otp_codes 테이블 | Task 1 |
| members ci_hash, identity_verified_at | Task 2 |
| NHN Cloud SMS 연동 | Task 3 |
| OTP JWT 세션 | Task 4 |
| getDonorSession 확장 | Task 5 |
| OTP 발송 API + rate limit | Task 6 |
| OTP 검증 + 세션 발급 API + 잠금 | Task 7 |
| OTP 로그인 UI + 로그인 페이지 통합 | Task 8 |
| 토스 본인인증 request/confirm API | Task 9 |
| 위저드 Step2 본인인증 UI | Task 10 |
| 취소 확인 모달 | Task 11 |
| 일시후원 취소 API | Task 12 |
| 정기후원 해지 API | Task 13 |
| 납입 내역 취소 버튼 | Task 14 |
| 대시보드 해지 + 비회원 분기 | Task 15 |

### 엣지 케이스 매핑
- OTP rate limit (1분): Task 6
- OTP 5회 실패 잠금: Task 7
- members 매칭 0건: Task 7 (`no_member` 응답)
- 본인인증 취소/실패: Task 10 (UI 복귀)
- 취소 7일 초과: Task 12
- NHN SMS 장애: Task 6 (502 응답)
