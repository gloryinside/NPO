/**
 * Integration test helpers for authenticated API route testing.
 *
 * buildAuthedRequest / buildAuthedFormRequest create NextRequest objects
 * with a valid Supabase session token in the Authorization header.
 *
 * The shared test user is created with `role: admin` and `org_id` in
 * app_metadata (what the app guards and, after migration 20261016000002,
 * the `is_org_admin()` RLS function trust).
 *
 * createTestCampaign inserts a campaign row and returns { id, org_id, slug }.
 */
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Shared state: a single org + admin user for all tests in a process.
// ---------------------------------------------------------------------------

let _sharedOrgId: string | null = null;
let _sharedToken: string | null = null;
let _sharedUserId: string | null = null;
let _sharedMemberId: string | null = null;

async function getSharedOrgAndToken(): Promise<{ orgId: string; token: string }> {
  if (_sharedOrgId && _sharedToken) {
    return { orgId: _sharedOrgId, token: _sharedToken };
  }

  const admin = createSupabaseAdminClient();
  const { data: org } = await admin.from('orgs').select('id').limit(1).single();
  if (!org) throw new Error('No org found — run seed first');
  const orgId = org.id;

  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `api-test-${suffix}@example.test`;
  // 이메일에서 유추할 수 없는 무작위 비밀번호(이 계정은 실제 DB의 관리자 권한을 가진다)
  const password = `${randomBytes(24).toString('base64url')}!Aa1`;

  // Create auth user with admin role + org_id so is_org_admin() and the API guards pass.
  // 권한은 app_metadata에(서비스 롤만 쓸 수 있음) — user_metadata는 사용자가 직접 바꿀 수 있어 신뢰하지 않는다.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: {
      role: 'admin',
      org_id: orgId,
    },
  });
  if (createErr || !created?.user) {
    throw new Error(`createUser failed: ${createErr?.message ?? 'no user'}`);
  }
  const userId = created.user.id;

  // Bind user to org via members row
  const memberCode = `API-TEST-${suffix}`;
  const { data: member, error: mErr } = await admin
    .from('members')
    .insert({
      org_id: orgId,
      member_code: memberCode,
      supabase_uid: userId,
      name: `API Test User ${suffix}`,
    })
    .select('id')
    .single();
  if (mErr || !member) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`members insert failed: ${mErr?.message ?? 'no member'}`);
  }

  // Sign in to get access token
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
  if (signInErr) {
    await admin.from('members').delete().eq('id', member.id);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    throw new Error(`signIn failed: ${signInErr.message}`);
  }

  const { data: sessionData } = await client.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) {
    throw new Error('Could not obtain access_token from signed-in client');
  }

  _sharedOrgId = orgId;
  _sharedToken = token;
  _sharedUserId = userId;
  _sharedMemberId = member.id;
  return { orgId, token };
}

/**
 * 테스트 파일마다 만든 공유 관리자·회원을 지운다(tests/integration/setup.ts의 afterAll).
 * 예전엔 지우지 않아 실행할 때마다 dev DB에 api-test 계정·API-TEST 회원이 쌓였다.
 */
export async function cleanupSharedUser(): Promise<void> {
  if (!_sharedUserId) return;
  const admin = createSupabaseAdminClient();
  if (_sharedMemberId) await admin.from('members').delete().eq('id', _sharedMemberId);
  const { error } = await admin.auth.admin.deleteUser(_sharedUserId);
  if (error) {
    // 감사 로그(audit_logs.actor_id)가 참조하면 지울 수 없다 → 권한을 걷고 차단
    await admin.auth.admin.updateUserById(_sharedUserId, {
      app_metadata: { role: null, org_id: null },
      ban_duration: '876000h',
    });
  }
  _sharedOrgId = _sharedToken = _sharedUserId = _sharedMemberId = null;
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

export async function buildAuthedRequest(
  method: string,
  url: string,
  body: unknown,
  opts: RequestInit = {},
): Promise<NextRequest> {
  const { token } = await getSharedOrgAndToken();
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`;

  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(opts.headers as Record<string, string> | undefined),
    },
    ...(body !== null && body !== undefined
      ? { body: JSON.stringify(body) }
      : {}),
  };

  return new NextRequest(fullUrl, init as ConstructorParameters<typeof NextRequest>[1]);
}

export async function buildAuthedFormRequest(
  method: string,
  url: string,
  fields: Record<string, string | Blob>,
  opts: RequestInit = {},
): Promise<NextRequest> {
  const { token } = await getSharedOrgAndToken();
  const fullUrl = url.startsWith('http') ? url : `http://localhost${url}`;

  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    fd.append(k, v);
  }

  return new NextRequest(fullUrl, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(opts.headers as Record<string, string> | undefined),
    },
    body: fd,
  });
}

// ---------------------------------------------------------------------------
// Campaign fixture
// ---------------------------------------------------------------------------

type CreateCampaignOpts = {
  page_content?: unknown;
  status?: string;
  [key: string]: unknown;
};

export async function createTestCampaign(opts: CreateCampaignOpts = {}): Promise<{
  id: string;
  org_id: string;
  slug: string;
}> {
  const { orgId } = await getSharedOrgAndToken();
  const admin = createSupabaseAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const slug = `test-camp-${suffix}`;

  const { data, error } = await admin
    .from('campaigns')
    .insert({
      org_id: orgId,
      title: `Test Campaign ${suffix}`,
      slug,
      donation_type: 'onetime',
      status: opts.status ?? 'draft',
      ...opts,
    })
    .select('id, org_id, slug')
    .single();

  if (error || !data) throw new Error(`createTestCampaign failed: ${error?.message}`);
  return data as { id: string; org_id: string; slug: string };
}
