import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole, type AdminRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";

const ALLOWED: AdminRole[] = ["super", "campaign_manager", "finance", "support"];

/**
 * G-D151: admin 역할 관리.
 *   GET  — 현재 기관의 모든 admin 사용자 + 보유 역할
 *   POST — 특정 user 에 역할 추가/삭제. super 역할 보유자만 가능.
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("admin_roles")
    .select("user_id, role, granted_at, granted_by")
    .eq("org_id", tenant.id)
    .order("granted_at", { ascending: false });

  // user_id → auth.users 이메일 매핑
  const ids = Array.from(
    new Set((data ?? []).map((r) => r.user_id as string))
  );
  const emails = new Map<string, string>();
  if (ids.length > 0) {
    const { data: usersPage } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    for (const u of usersPage?.users ?? []) {
      if (u.email) emails.set(u.id, u.email);
    }
  }

  // user 별로 묶기
  const byUser = new Map<
    string,
    { email: string | null; roles: AdminRole[]; grantedAt: string | null }
  >();
  for (const r of (data ?? []) as Array<{
    user_id: string;
    role: AdminRole;
    granted_at: string;
  }>) {
    const prev = byUser.get(r.user_id) ?? {
      email: emails.get(r.user_id) ?? null,
      roles: [],
      grantedAt: null,
    };
    prev.roles.push(r.role);
    if (!prev.grantedAt || r.granted_at > prev.grantedAt) {
      prev.grantedAt = r.granted_at;
    }
    byUser.set(r.user_id, prev);
  }

  return NextResponse.json({
    items: [...byUser.entries()].map(([userId, v]) => ({
      userId,
      email: v.email,
      roles: v.roles,
      grantedAt: v.grantedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  // super 역할만 역할 배분 가능
  if (!(await hasAnyRole(user.id, tenant.id, ["super"]))) {
    return NextResponse.json(
      { error: "super 역할이 필요합니다." },
      { status: 403 }
    );
  }

  let body: { userId?: unknown; role?: unknown; action?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role =
    typeof body.role === "string" && ALLOWED.includes(body.role as AdminRole)
      ? (body.role as AdminRole)
      : null;
  const action = body.action === "remove" ? "remove" : "add";
  if (!userId || !role) {
    return NextResponse.json(
      { error: "userId, role 필수" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseAdminClient();
  if (action === "remove") {
    const { error } = await supabase
      .from("admin_roles")
      .delete()
      .eq("org_id", tenant.id)
      .eq("user_id", userId)
      .eq("role", role);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from("admin_roles").upsert(
      {
        org_id: tenant.id,
        user_id: userId,
        role,
        granted_by: user.id,
      },
      { onConflict: "org_id,user_id,role" }
    );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.org_settings_change",
    resourceType: "admin_role",
    resourceId: userId,
    summary: `역할 ${action === "add" ? "부여" : "회수"}: ${role}`,
    metadata: { userId, role, action },
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
