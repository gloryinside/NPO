import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";
import { hasAnyRole } from "@/lib/auth/admin-rbac";
import { logAudit } from "@/lib/audit";

/**
 * G-D152: 기관별 admin 알림 설정 조회/저장.
 */
const ALLOWED_KEYS = new Set([
  "payment_failed",
  "chargeback",
  "email_bounce_spike",
  "campaign_milestone_50",
  "campaign_milestone_100",
  "manual_payment_requires_match",
  "pg_outage",
]);

export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("orgs")
    .select("admin_notification_prefs")
    .eq("id", guard.ctx.tenant.id)
    .maybeSingle();
  return NextResponse.json({
    prefs: (data?.admin_notification_prefs ?? {}) as Record<string, boolean>,
  });
}

export async function PATCH(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  if (!(await hasAnyRole(user.id, tenant.id, ["super"]))) {
    return NextResponse.json(
      { error: "super 권한 필요" },
      { status: 403 }
    );
  }

  let body: { prefs?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.prefs || typeof body.prefs !== "object") {
    return NextResponse.json({ error: "prefs 객체 필수" }, { status: 400 });
  }

  const filtered: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(body.prefs as Record<string, unknown>)) {
    if (ALLOWED_KEYS.has(k) && typeof v === "boolean") filtered[k] = v;
  }

  const supabase = createSupabaseAdminClient();
  // 기존 값과 병합
  const { data: cur } = await supabase
    .from("orgs")
    .select("admin_notification_prefs")
    .eq("id", tenant.id)
    .maybeSingle();
  const merged = {
    ...((cur?.admin_notification_prefs as Record<string, boolean>) ?? {}),
    ...filtered,
  };

  const { error } = await supabase
    .from("orgs")
    .update({ admin_notification_prefs: merged })
    .eq("id", tenant.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    orgId: tenant.id,
    actorId: user.id,
    actorEmail: user.email ?? null,
    action: "admin.org_settings_change",
    resourceType: "notification_prefs",
    summary: "admin 알림 설정 변경",
    metadata: { changed: filtered },
  }).catch(() => {});

  return NextResponse.json({ ok: true, prefs: merged });
}
