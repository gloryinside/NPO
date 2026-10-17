import type { User } from '@supabase/supabase-js'

/**
 * 관리자 권한 판정 — 단 한 곳.
 *
 * [보안] 역할·소속은 app_metadata에서만 읽는다.
 *   user_metadata는 로그인한 사용자 본인이 브라우저에서
 *   supabase.auth.updateUser({ data: { role: 'admin', org_id } })로 바꿀 수 있다.
 *   후원자도 Supabase 계정으로 가입하므로, user_metadata를 믿으면
 *   아무 후원자나 원하는 기관의 관리자가 될 수 있었다.
 *   app_metadata는 서비스 롤(서버)만 쓸 수 있다. DB의 is_org_admin()도 같은 기준.
 */
export type AdminClaims = { role: 'admin'; orgId: string }

export function adminClaims(user: User | null | undefined): AdminClaims | null {
  const meta = (user?.app_metadata ?? {}) as Record<string, unknown>
  if (meta.role !== 'admin' || typeof meta.org_id !== 'string' || !meta.org_id) return null
  return { role: 'admin', orgId: meta.org_id }
}

/** 관리자가 "이 테넌트"의 관리자인지 — 역할 + 소속 기관 일치 */
export function isAdminOfTenant(user: User | null | undefined, tenantId: string | null | undefined): boolean {
  if (!tenantId) return false
  return adminClaims(user)?.orgId === tenantId
}

/** 서비스 롤로 관리자 권한을 부여할 때 쓰는 app_metadata 조각 */
export function adminAppMetadata(orgId: string) {
  return { role: 'admin', org_id: orgId }
}
