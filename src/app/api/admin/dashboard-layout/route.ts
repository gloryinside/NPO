import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * G-D198: admin 대시보드 개인 레이아웃 저장/조회.
 *   GET  → 현재 user 의 widget_config
 *   PUT  body: { config: { order: string[], hidden?: string[] } }
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("admin_dashboard_layouts")
    .select("widget_config, updated_at")
    .eq("org_id", tenant.id)
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({
    config: data?.widget_config ?? {},
    updatedAt: data?.updated_at ?? null,
  });
}

export async function PUT(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;

  let body: { config?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.config || typeof body.config !== "object") {
    return NextResponse.json({ error: "config 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("admin_dashboard_layouts").upsert(
    {
      org_id: tenant.id,
      user_id: user.id,
      widget_config: body.config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,user_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
