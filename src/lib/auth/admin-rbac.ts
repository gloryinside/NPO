import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * G-D150: Admin 세부 역할 조회 + 허용 여부 체크.
 *
 * 기본 원칙:
 *   - auth.users.user_metadata.role === 'admin' 은 "관리자 로그인 가능" 수준
 *   - 세부 권한은 admin_roles 테이블의 role 값으로 판단
 *   - admin_roles 에 row 가 하나도 없는 admin 은 'super' 로 간주 (단일 운영자 초기 편의)
 *
 * 사용:
 *   const { ok, roles } = await getAdminRoles(userId, orgId);
 *   if (!ok || !roles.includes('finance')) return 403;
 */
export type AdminRole = "super" | "campaign_manager" | "finance" | "support";

export async function getAdminRoles(
  userId: string,
  orgId: string
): Promise<{ ok: boolean; roles: AdminRole[] }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("admin_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("org_id", orgId);
  if (error) return { ok: false, roles: [] };
  const rows = (data ?? []) as Array<{ role: AdminRole }>;
  if (rows.length === 0) {
    // 초기 편의: admin_roles 미등록 사용자는 super 간주.
    // 운영 중에는 첫 접속 직후 UI 에서 명시적 역할 할당 권장.
    return { ok: true, roles: ["super"] };
  }
  return { ok: true, roles: rows.map((r) => r.role) };
}

export async function hasAnyRole(
  userId: string,
  orgId: string,
  allowed: AdminRole[]
): Promise<boolean> {
  const { ok, roles } = await getAdminRoles(userId, orgId);
  if (!ok) return false;
  if (roles.includes("super")) return true;
  return allowed.some((r) => roles.includes(r));
}
