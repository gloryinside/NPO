/**
 * API 라우트 전용 인증 가드
 *
 * 페이지용 `requireAdminUser` + `requireTenant`는 실패 시 redirect·throw로
 * 동작하는데, fetch 클라이언트가 받으면 307 HTML 또는 500이 되어 파싱 오류를
 *일으킨다. API용은 JSON 401/403/503을 명시적으로 반환한다.
 *
 * 보안 모델은 기존과 동일 — 도메인 기반 tenant + role==='admin' 조합.
 * (builder-guard와 달리 user_metadata.org_id 대신 tenant를 본다)
 */
import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/auth'
import { getTenant } from '@/lib/tenant/context'
import type { Tenant } from '@/lib/tenant/types'
import type { User } from '@supabase/supabase-js'

export type ApiAdminContext = { user: User; tenant: Tenant }

export async function requireAdminApi(): Promise<
  | { ok: true; ctx: ApiAdminContext }
  | { ok: false; response: NextResponse }
> {
  const user = await getAdminUser()
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }

  if (user.user_metadata?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }

  const tenant = await getTenant()
  if (!tenant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'tenant not resolved — 도메인 매핑을 확인하세요.' },
        { status: 400 }
      ),
    }
  }

  return { ok: true, ctx: { user, tenant } }
}
