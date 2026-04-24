import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * GET  /api/admin/members/[id]/tags  — 회원에게 부여된 태그 목록
 * PUT  /api/admin/members/[id]/tags  — 태그 일괄 교체 (body.tagIds: string[])
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant } = guard.ctx;
  const { id: memberId } = await params;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("member_tag_assignments")
    .select("tag_id, member_tags(id, name, color)")
    .eq("org_id", tenant.id)
    .eq("member_id", memberId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data ?? [] });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = checkCsrf(req);
  if (csrf) return csrf;
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;
  const { tenant, user } = guard.ctx;
  const { id: memberId } = await params;

  let body: { tagIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const tagIds = Array.isArray(body.tagIds)
    ? (body.tagIds as unknown[]).filter((x): x is string => typeof x === "string")
    : null;
  if (!tagIds) {
    return NextResponse.json({ error: "tagIds 배열 필수" }, { status: 400 });
  }

  const supabase = createSupabaseAdminClient();

  // 1) 기존 매핑 모두 삭제
  await supabase
    .from("member_tag_assignments")
    .delete()
    .eq("org_id", tenant.id)
    .eq("member_id", memberId);

  // 2) 새 매핑 추가
  if (tagIds.length > 0) {
    const rows = tagIds.map((tagId) => ({
      org_id: tenant.id,
      member_id: memberId,
      tag_id: tagId,
      assigned_by: user.id,
    }));
    const { error } = await supabase.from("member_tag_assignments").insert(rows);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, count: tagIds.length });
}
