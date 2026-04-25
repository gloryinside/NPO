import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/api-guard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { checkCsrf } from "@/lib/security/csrf";

/**
 * POST /api/admin/revenue-journals/[id]/approve
 *   결의 승인 (draft → approved). 요청자와 다른 admin이 승인 가능.
 */
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

  const supabase = createSupabaseAdminClient();
  const { data: journal } = await supabase
    .from("revenue_journals")
    .select("id, status, created_by")
    .eq("id", id)
    .eq("org_id", tenant.id)
    .maybeSingle();
  if (!journal) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (journal.status !== "draft") {
    return NextResponse.json({ error: `이미 ${journal.status} 상태` }, { status: 400 });
  }
  if (journal.created_by === user.id) {
    return NextResponse.json({ error: "요청자 본인은 승인할 수 없습니다." }, { status: 403 });
  }

  const { error } = await supabase
    .from("revenue_journals")
    .update({
      status: "approved",
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
