import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/admin/email-templates/[id]/versions  — 버전 이력
 * POST /api/admin/email-templates/[id]/versions  — 현재 템플릿을 새 버전으로 스냅샷
 *   body: { changeNote?: string }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("email_template_versions")
    .select("id, version, subject, change_note, changed_by, created_at")
    .eq("org_id", tenant.id)
    .eq("template_id", id)
    .order("version", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id } = await params;

  let body: { changeNote?: unknown };
  try { body = await req.json(); }
  catch { body = {}; }

  const supabase = createSupabaseAdminClient();
  const { data: tpl } = await supabase
    .from("email_templates")
    .select("subject, body_json, body_html")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!tpl) return NextResponse.json({ error: "template not found" }, { status: 404 });

  // 다음 version 번호
  const { data: maxRow } = await supabase
    .from("email_template_versions")
    .select("version")
    .eq("template_id", id)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = ((maxRow as { version?: number } | null)?.version ?? 0) + 1;

  const { data, error } = await supabase
    .from("email_template_versions")
    .insert({
      template_id: id,
      org_id: tenant.id,
      version: nextVersion,
      subject: tpl.subject,
      body_json: tpl.body_json,
      body_html: tpl.body_html,
      changed_by: user.id,
      change_note: typeof body.changeNote === "string" ? body.changeNote : null,
    })
    .select("id, version")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data?.id, version: data?.version });
}
