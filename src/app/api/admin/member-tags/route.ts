import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/admin/member-tags  — org의 모든 태그 마스터 조회
 * POST /api/admin/member-tags  — 새 태그 생성
 *   body: { name: string, color?: string, description?: string }
 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_tags")
    .select("id, name, color, description, created_at")
    .eq("org_id", tenant.id)
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;

  let body: { name?: unknown; color?: unknown; description?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 30) {
    return NextResponse.json(
      { error: "name 필수 (1~30자)" },
      { status: 400 }
    );
  }
  const color = typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
    ? body.color
    : "#6366f1";
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 200) : null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_tags")
    .insert({ org_id: tenant.id, name, color, description })
    .select("id, name, color, description")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "이미 존재하는 태그명" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ tag: data });
}
